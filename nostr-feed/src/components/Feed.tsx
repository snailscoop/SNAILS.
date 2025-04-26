import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { Note } from './Note';
import { RepostNote } from './RepostNote';

// Cache for post data across feeds
const feedCache = new Map<string, NDKEvent[]>();

interface FeedProps {
  filter?: NDKFilter;
  limit?: number;
}

export function Feed({ filter = {}, limit = 50 }: FeedProps) {
  const { subscribeToNotes } = useNostrContext();
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);
  const eventsRef = useRef<NDKEvent[]>([]);
  const hasLoadedRef = useRef<boolean>(false);
  
  // Generate a unique cache key based on the filter
  const cacheKey = useMemo(() => {
    const filterKey = JSON.stringify(filter);
    return `${filterKey}-${limit}`;
  }, [filter, limit]);
  
  // Use useMemo for filter to prevent unnecessary re-renders
  const combinedFilter = useMemo(() => {
    // Create a combined filter
    const result: NDKFilter = {
      kinds: [1], // Text notes
      limit,
      ...filter
    };

    // IMPORTANT: Ensure we have at least one valid filter criteria to avoid "No filters to merge" error
    const hasValidFilter = (result.authors && result.authors.length > 0) || 
                           result.since || 
                           result['#e'] || 
                           result['#p'] ||
                           (result.ids && result.ids.length > 0);
                           
    if (!hasValidFilter) {
      // Add a time constraint if no other criteria, go back 30 days instead of 24 hours
      // to ensure we have enough content
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
      result.since = thirtyDaysAgo;
    }
    
    console.log('Combined filter:', result);
    return result;
  }, [filter, limit]);
  
  // Memoize the authors from the filter
  const authorsFilter = useMemo(() => {
    const authors = combinedFilter.authors as string[] | undefined;
    // Ensure authors is either undefined or a non-empty array to avoid filter errors
    return authors && authors.length > 0 ? authors : undefined;
  }, [combinedFilter.authors]);
  
  // Event handler callback
  const handleEvent = useCallback((event: NDKEvent) => {
    setEvents((prev) => {
      // Check if we've already reached the limit
      if (prev.length >= limit) {
        // If we have enough events, don't add more
        return prev;
      }
      
      // Check if event already exists
      if (prev.some(e => e.id === event.id)) {
        return prev;
      }
      
      // Add new event and sort by creation time (newest first)
      const newEvents = [...prev, event].sort((a, b) => {
        return (b.created_at || 0) - (a.created_at || 0);
      });
      
      // Return at most 'limit' events
      const result = newEvents.slice(0, limit);
      eventsRef.current = result;
      
      // Update the cache
      feedCache.set(cacheKey, result);
      
      return result;
    });
  }, [limit, cacheKey]);
  
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

  // This useEffect handles the one-time feed loading
  useEffect(() => {
    // Skip if we've already loaded data for this component instance
    if (hasLoadedRef.current) {
      return;
    }
    
    let isMounted = true;
    
    const fetchEvents = async () => {
      if (!isMounted) return;
      
      // First check if we have cached data
      if (feedCache.has(cacheKey)) {
        console.log('Using cached feed data:', cacheKey);
        const cachedEvents = feedCache.get(cacheKey)!;
        setEvents(cachedEvents);
        setLoading(false);
        eventsRef.current = cachedEvents;
        hasLoadedRef.current = true;
        return;
      }
      
      // Clean up previous resources
      cleanup();
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Subscribing with filter:', combinedFilter);
        
        // Subscribe to events and handle incoming events
        const sub = await subscribeToNotes(
          authorsFilter,
          limit,
          handleEvent
        );

        if (isMounted && sub) {
          subscriptionRef.current = sub;
          
          // Stop loading after a few events or a timeout
          const loadingTimeoutId = setTimeout(() => {
            if (isMounted) {
              setLoading(false);
              hasLoadedRef.current = true;
            }
          }, 5000); // Shorter timeout to avoid freezing
          
          timeoutIdsRef.current.push(loadingTimeoutId);
          
          // Schedule subscription closing
          const closeTimeoutId = setTimeout(() => {
            if (sub && isMounted) {
              sub.stop();
              // We don't set subscriptionRef.current to null here to prevent 
              // creating new subscriptions when component re-renders
            }
          }, 15000); // Close subscription after 15 seconds
          
          timeoutIdsRef.current.push(closeTimeoutId);
        } else {
          // No subscription was created, so stop loading
          setLoading(false);
          hasLoadedRef.current = true;
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
        if (isMounted) {
          setLoading(false);
          setError('Failed to load feed');
          hasLoadedRef.current = true;
        }
      }
    };

    fetchEvents();

    // Cleanup subscription and timeouts on unmount
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [cleanup, subscribeToNotes, handleEvent, combinedFilter, authorsFilter, cacheKey]);

  // Listen for refresh events from the header refresh button
  useEffect(() => {
    const handleRefresh = () => {
      // Don't recreate subscription, just pass events again
      const currentEvents = eventsRef.current;
      setEvents([]); // Reset events
      // Small timeout before setting back the events to create visual feedback
      setTimeout(() => {
        setEvents(currentEvents);
      }, 300);
    };

    window.addEventListener('feed-refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('feed-refresh', handleRefresh);
    };
  }, []);

  const renderEvent = (event: NDKEvent) => {
    // Check if this is a repost (kind 6)
    if (event.kind === 6) {
      return <RepostNote key={event.id} event={event} />;
    }

    // Regular note (kind 1)
    return <Note key={event.id} event={event} />;
  };

  return (
    <div className="feed-container">
      {loading && events.length === 0 ? (
        <div className="feed-loading">Loading posts...</div>
      ) : error ? (
        <div className="feed-error">
          <p>{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="feed-empty">No posts found.</div>
      ) : (
        <div className="feed-content">
          {events.map(renderEvent)}
        </div>
      )}
    </div>
  );
} 