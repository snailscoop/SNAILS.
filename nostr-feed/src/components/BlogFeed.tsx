import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { BlogNote } from './BlogNote';

interface BlogFeedProps {
  filter?: NDKFilter;
  limit?: number;
}

export function BlogFeed({ filter = {}, limit = 30 }: BlogFeedProps) {
  const { subscribeToNotes } = useNostrContext();
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);
  const eventsRef = useRef<NDKEvent[]>([]);

  // Use useMemo for filter to prevent unnecessary re-renders
  const combinedFilter = useMemo(() => {
    // Create a combined filter
    const result: NDKFilter = {
      kinds: [30023], // Long-form content kind (NIP-23)
      limit: limit * 2, // Double the requested limit to ensure we get enough posts
      ...filter
    };

    // Add specific since filter to avoid fetching too much data
    if (!result.since) {
      // Get events from the last 30 days by default for faster loading
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
      result.since = thirtyDaysAgo;
    }
    
    return result;
  }, [filter, limit]);
  
  // Memoize the authors from the filter
  const authorsFilter = useMemo(() => {
    return combinedFilter.authors as string[] | undefined;
  }, [combinedFilter.authors]);
  
  // Event handler callback - with simplified filtering (only length check)
  const handleEvent = useCallback((event: NDKEvent) => {
    // Verify content has adequate length
    const contentLength = event.content?.length || 0;
    if (contentLength < 800) {
      return;
    }
    
    setEvents((prev) => {
      // Check if event already exists
      if (prev.some(e => e.id === event.id)) {
        return prev;
      }
      
      // Add new event and sort by creation time
      const newEvents = [...prev, event].sort((a, b) => {
        // Sort by recency (newer first)
        return (b.created_at || 0) - (a.created_at || 0);
      });
      
      // Return up to limit*2 events to display more content
      const result = newEvents.slice(0, limit * 2);
      eventsRef.current = result;
      return result;
    });
  }, [limit]);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear all timeouts
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current = [];
    
    // Clean up subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.stop();
      subscriptionRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchEvents = async () => {
      if (!isMounted) return;
      
      // Clean up previous resources
      cleanup();
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Subscribing to blogs with filter:', combinedFilter);
        
        // Subscribe to events and handle incoming events
        const sub = await subscribeToNotes(
          authorsFilter, 
          combinedFilter.limit as number || limit * 2, // Ensure we request plenty of events 
          handleEvent
        );

        if (isMounted) {
          subscriptionRef.current = sub;
          
          // Show content faster - further reduced loading timeout
          const loadingTimeoutId = setTimeout(() => {
            if (isMounted) {
              setLoading(false);
            }
          }, 2000); // Reduced from 3000ms to 2000ms
          
          timeoutIdsRef.current.push(loadingTimeoutId);
          
          // Show content as soon as we have ANY events - check more frequently
          const earlyLoadingCheckId = setInterval(() => {
            if (isMounted && events.length > 0) {
              setLoading(false);
              clearInterval(earlyLoadingCheckId);
            }
          }, 300); // Check every 300ms instead of 500ms
          
          timeoutIdsRef.current.push(earlyLoadingCheckId);
          
          // Keep subscription open for less time to improve perceived performance
          const closeTimeoutId = setTimeout(() => {
            if (sub && isMounted) {
              sub.stop();
            }
          }, 15000); // 15 seconds total timeout (reduced from 30s)
          
          timeoutIdsRef.current.push(closeTimeoutId);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
        if (isMounted) {
          setLoading(false);
          setError('Failed to load blog posts');
        }
      }
    };

    fetchEvents();

    // Cleanup subscription and timeouts on unmount
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [authorsFilter, combinedFilter, handleEvent, limit, subscribeToNotes, cleanup, events.length]);

  if (error) {
    return (
      <div className="feed-error">
        <p>{error}</p>
      </div>
    );
  }

  // Show content faster - display loading message alongside any received events
  return (
    <div className="blog-feed-container">
      {events.length === 0 ? (
        <div className="feed-loading">
          <p>Loading blog posts...</p>
        </div>
      ) : (
        <>
          <div className="feed-count">
            Showing {events.length} blog posts {loading && <span>(loading more...)</span>}
          </div>
          {events.map((event) => (
            <BlogNote key={event.id} event={event} />
          ))}
          {loading && events.length < 10 && (
            <div className="feed-loading-more">
              <p>Loading more posts...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
} 