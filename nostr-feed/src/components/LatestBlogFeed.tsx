import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { BlogNote } from './BlogNote';

interface LatestBlogFeedProps {
  filter?: NDKFilter;
  limit?: number;
}

export function LatestBlogFeed({ filter = {}, limit = 20 }: LatestBlogFeedProps) {
  const { ndk } = useNostrContext();
  const [events, setEvents] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedAuthorsRef = useRef<Map<string, number>>(new Map());

  // Create a simple filter for blog posts from the last 30 days
  const blogFilter = useMemo(() => {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    return {
      kinds: [30023], // Long-form content kind (NIP-23)
      since: thirtyDaysAgo,
      limit: 200 // Get a larger initial set to filter from
    };
  }, []);

  // Quality filter with our standards
  const isQualityBlogPost = useCallback((event: NDKEvent): boolean => {
    // Must have content with adequate length
    if (!event.content || event.content.length < 800) {
      return false;
    }

    // Must have pubkey
    if (!event.pubkey) {
      return false;
    }

    // Check author quota (max 2 posts per author)
    const authorCount = processedAuthorsRef.current.get(event.pubkey) || 0;
    if (authorCount >= 2) {
      return false;
    }

    // Update author count
    processedAuthorsRef.current.set(event.pubkey, authorCount + 1);

    // Check for title tag or title-like first line
    const hasTitle = event.tags?.some(tag => tag[0] === 'title' && tag[1]?.trim().length > 0);
    if (!hasTitle) {
      const firstLine = event.content.split('\n')[0]?.trim();
      if (!firstLine || firstLine.length < 10 || firstLine.length > 100) {
        return false;
      }
    }

    // Check for spam patterns
    const spamPatterns = [
      /investor who can lend/i,
      /looking for an investor/i,
      /lend \d{2},\d{3}/i,
      /furniture manufacturing/i,
      /holding/i,
      /\bspam\b/i,
      /\bscam\b/i,
      /\bairdr[o0]p\b/i,
      /\bgiveaway\b/i,
      /\bclaim\s*now\b/i,
      /\bcasino\b/i
    ];

    if (spamPatterns.some(pattern => pattern.test(event.content))) {
      return false;
    }

    // Check for proper formatting (paragraphs)
    if (!event.content.includes('\n\n')) {
      return false;
    }

    return true;
  }, []);

  useEffect(() => {
    if (!ndk) {
      setError('NDK not initialized');
      setLoading(false);
      return;
    }

    let mounted = true;
    
    const fetchBlogPosts = async () => {
      try {
        console.log('Fetching blog posts with filter:', blogFilter);
        setLoading(true);
        
        // Reset author tracking
        processedAuthorsRef.current = new Map();
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set a timeout to ensure we don't wait forever
        timeoutRef.current = setTimeout(() => {
          if (mounted && loading) {
            console.log('Timeout reached, using what we have so far');
            setLoading(false);
          }
        }, 8000);

        // Fetch events directly
        const fetchedEvents = await ndk.fetchEvents(blogFilter);
        
        if (!mounted) return;
        
        // Convert to array and apply our quality filter
        const allEvents = [...fetchedEvents];
        const qualityEvents = allEvents.filter(isQualityBlogPost);
        
        // Sort by creation time (newer first)
        qualityEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        // Take up to limit events
        const displayEvents = qualityEvents.slice(0, limit);
        
        const totalFetched = fetchedEvents.size;
        const filteredCount = qualityEvents.length;
        
        console.log(`Fetched ${totalFetched} blogs, ${filteredCount} passed quality filter`);
        setStats(`Fetched: ${totalFetched}, Quality: ${filteredCount}`);
        
        setEvents(displayEvents);
        setLoading(false);
        
        // Clear the timeout since we're done
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      } catch (error) {
        console.error('Error fetching blog posts:', error);
        if (mounted) {
          setError('Failed to load blog posts');
          setLoading(false);
        }
      }
    };

    fetchBlogPosts();

    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [ndk, blogFilter, isQualityBlogPost, limit]);

  if (error) {
    return (
      <div className="feed-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="blog-feed-container">
      {loading ? (
        <div className="feed-loading">
          <p>Loading high-quality blog posts...</p>
          <p className="feed-loading-subtitle">Filtering for blog quality</p>
        </div>
      ) : (
        <>
          <div className="feed-count">
            {events.length > 0 ? (
              <>Showing {events.length} quality blog posts {stats && <span className="feed-stats">({stats})</span>}</>
            ) : (
              <>No quality blog posts found. Try again later.</>
            )}
          </div>
          {events.map((event) => (
            <BlogNote key={event.id} event={event} />
          ))}
        </>
      )}
    </div>
  );
} 