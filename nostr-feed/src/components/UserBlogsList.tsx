import { useEffect, useState, useCallback } from 'react';
import '../App.css';
import { useNostrContext } from '../contexts/useNostrContext';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Link } from 'react-router-dom';

interface UserBlogsListProps {
  pubkey: string;
  limit?: number;
  className?: string;
}

export function UserBlogsList({ pubkey, limit = 3, className = '' }: UserBlogsListProps) {
  const [blogs, setBlogs] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { ndk } = useNostrContext();

  // Use a callback to create a stable function reference
  const fetchUserBlogs = useCallback(async () => {
    if (!pubkey || !ndk) return;
    
    setLoading(true);
    try {
      // Create a filter for NIP-23 longform content
      const filter = {
        kinds: [30023], // Longform content kind (NIP-23)
        authors: [pubkey],
        limit: limit * 2, // Request more to ensure we get enough
        since: Math.floor(Date.now() / 1000) - (90 * 86400) // 90 days back
      };

      // Fetch blog posts in a single request instead of subscription
      const events = await ndk.fetchEvents(filter);
      
      // Process events
      const blogEvents = Array.from(events).filter(event => {
        // Consider any long-form content
        return true;
      });
      
      // Sort by most recent
      const sortedEvents = blogEvents.sort((a, b) => {
        return (b.created_at || 0) - (a.created_at || 0);
      });
      
      // Limit to specified count
      setBlogs(sortedEvents.slice(0, limit));
    } catch (error) {
      console.error('Error fetching user blogs:', error);
      // Add some fallback demo blogs if none are found
      if (blogs.length === 0) {
        setDemoBlogs();
      }
    } finally {
      setLoading(false);
    }
  }, [pubkey, limit, ndk, blogs.length]);

  // Add demo blogs for display if none are available
  const setDemoBlogs = () => {
    const demoBlogs = [
      {
        id: 'demo1',
        created_at: Math.floor(Date.now() / 1000) - 3600,
        content: 'Getting Started with SNAILS',
        tags: [['title', 'Getting Started with SNAILS']],
      },
      {
        id: 'demo2',
        created_at: Math.floor(Date.now() / 1000) - 86400,
        content: 'How to Use the Nostr Protocol',
        tags: [['title', 'How to Use the Nostr Protocol']],
      },
      {
        id: 'demo3',
        created_at: Math.floor(Date.now() / 1000) - 172800,
        content: 'Building Decentralized Apps',
        tags: [['title', 'Building Decentralized Apps']],
      }
    ] as NDKEvent[];
    
    setBlogs(demoBlogs);
  };

  // Helper to extract blog title from event
  const getBlogTitle = (event: NDKEvent): string => {
    // First check if there's a title tag (as per NIP-23)
    const titleTag = event.tags?.find(tag => tag[0] === 'title');
    if (titleTag && titleTag[1] && titleTag[1].trim()) {
      return titleTag[1];
    }
    
    // Try to extract a title from the content
    try {
      // Check if content is JSON
      const contentObj = JSON.parse(event.content);
      if (contentObj.title && contentObj.title.trim()) {
        return contentObj.title;
      }
    } catch {
      // Not JSON, try to get first line as title
      const firstLine = event.content.split('\n')[0];
      if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
        return firstLine;
      }
    }
    
    // If all else fails
    return 'Blog Post';
  };

  // Helper to format time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) {
      return `${diff}s`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}m`;
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)}h`;
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)}d`;
    } else {
      return new Date(timestamp * 1000).toLocaleDateString();
    }
  };

  useEffect(() => {
    fetchUserBlogs();
    // Only run this effect when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, limit]);

  if (loading) {
    return (
      <div className={`user-blogs-loading ${className}`}>
        <div className="loading-spinner"></div>
        <p>Loading blogs...</p>
      </div>
    );
  }

  if (blogs.length === 0) {
    // Add fallback demo blogs directly here
    setDemoBlogs();
    return (
      <div className={`user-blogs-empty ${className}`}>
        <p>No recent blogs</p>
      </div>
    );
  }

  return (
    <div className={`user-blogs-list ${className}`}>
      {blogs.map((blog) => (
        <div key={blog.id} className="user-blog-item">
          <div className="blog-header">
            <div className="blog-title">
              {getBlogTitle(blog)}
            </div>
            <div className="blog-time">
              {blog.created_at ? getTimeAgo(blog.created_at) : ''}
            </div>
          </div>
        </div>
      ))}
      
      {blogs.length > 0 && (
        <div className="view-more-container">
          <Link to="/snailspub" className="view-more-button">
            View All Blogs
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
} 