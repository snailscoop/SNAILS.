import { useState, useMemo, useCallback, useEffect } from 'react';
import { BlogFeed } from '../components/BlogFeed';
import { TrendingHashtags } from '../components/TrendingHashtags';
import { useNostrContext } from '../contexts/useNostrContext';
import { ProfileCard } from '../components/ProfileCard';
import { ContentEmbeds } from '../components/ContentEmbeds';

export function SnailsPubPage() {
  const { isConnected, isLoading, saveRelays, currentUser, getFollowing } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('latest');
  const [userFollowing, setUserFollowing] = useState<string[]>([]);
  const [followedContent, setFollowedContent] = useState<{content: string, id: string}[]>([]);
  const [showEmbeds, setShowEmbeds] = useState(true);

  // Connect to blog-specific relays for better content discovery
  useEffect(() => {
    const connectToRecommendedRelays = async () => {
      // These are relays known to have good blog content
      const blogRelays = [
        'wss://relay.nostr.band', // Good search functionality
        'wss://nos.lol', // Popular relay with good content
        'wss://relay.damus.io', // Another popular relay
        'wss://relay.snort.social', // Good for blog content
        'wss://nostr.wine' // High-quality content relay
      ];
      
      // Save these relays using the available method from context
      try {
        await saveRelays(blogRelays);
        console.log('Connected to blog relays for better content discovery');
      } catch (e) {
        console.warn('Failed to connect to blog relays:', e);
      }
    };
    
    connectToRecommendedRelays();
  }, [saveRelays]);

  // Load user's following list
  useEffect(() => {
    if (isConnected && currentUser) {
      const loadFollowing = async () => {
        try {
          const following = await getFollowing(currentUser.pubkey);
          setUserFollowing(following);
          console.log('Loaded following list:', following.length, 'accounts');
        } catch (e) {
          console.error('Failed to load following list:', e);
        }
      };
      
      loadFollowing();
    }
  }, [isConnected, currentUser, getFollowing]);

  // Create a filter specifically for long-form content (kind 30023 for articles)
  // NIP-23 defines kind:30023 as the event kind for long-form content (blogs/articles)
  const blogFilter = useMemo(() => {
    // Get articles from the last 90 days for a much broader selection
    // Habla.news uses a longer timeframe to find more quality content
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
    return {
      kinds: [30023], // Long-form content kind (NIP-23)
      since: ninetyDaysAgo,
      limit: 100 // Increased limit for more content
    };
  }, []);
  
  // Popular blog filter with sorting by created_at
  const popularBlogFilter = useMemo(() => {
    // Get articles from the last 30 days for popular content
    // This gives us recent but still popular content
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    return {
      kinds: [30023],
      since: thirtyDaysAgo,
      limit: 75 // Increased limit for more content discovery
    };
  }, []);

  // Following filter based on user follows (now implemented)
  const followingBlogFilter = useMemo(() => {
    // Get articles from the last 180 days for followed authors
    // Longer timeframe because we care more about authors we follow
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 86400;
    
    // Only add authors filter if we have following data
    if (userFollowing.length === 0) {
      return {
        kinds: [30023],
        since: sixMonthsAgo,
        limit: 100 // Higher limit for followed authors
      };
    }
    
    return {
      kinds: [30023],
      since: sixMonthsAgo,
      authors: userFollowing,
      limit: 100 // Higher limit for followed authors
    };
  }, [userFollowing]);
  
  // Example followed content with embeds for demonstration
  useEffect(() => {
    if (activeTab === 'following' && userFollowing.length > 0) {
      // Add some placeholder content until the feed loads
      setFollowedContent([
        { 
          content: "Check out this great tutorial on Nostr development https://github.com/nostr-protocol/nostr", 
          id: "demo1" 
        },
        { 
          content: "I found this interesting YouTube video about decentralized social networks https://www.youtube.com/watch?v=dQw4w9WgXcQ", 
          id: "demo2" 
        }
      ]);
    }
  }, [activeTab, userFollowing.length]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    // Force refresh the feed
    setRefreshKey(prev => prev + 1);
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [isRefreshing]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);

  const toggleEmbeds = useCallback(() => {
    setShowEmbeds(prev => !prev);
  }, []);

  const renderLatestContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Latest Blogs</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <BlogFeed key={refreshKey} filter={blogFilter} limit={50} />
      </div>
    );
  };

  const renderPopularContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }
    
    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Popular Blogs</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="popular-blogs-description">
          <p>Recent articles from the Nostr network</p>
        </div>
        <BlogFeed key={refreshKey} filter={popularBlogFilter} limit={50} />
      </div>
    );
  };

  const renderFollowingContent = () => (
    <div className="following-container">
      <h2>Blogs from People You Follow</h2>
      {isConnected ? (
        userFollowing.length > 0 ? (
          <div className="following-feed">
            <div className="feed-header">
              <div className="feed-controls">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="refresh-button"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={toggleEmbeds}
                  className="embed-toggle-button"
                >
                  {showEmbeds ? 'Hide Embeds' : 'Show Embeds'}
                </button>
              </div>
            </div>
            
            <BlogFeed key={refreshKey} filter={followingBlogFilter} limit={50} />
            
            {/* Demo of ContentEmbeds functionality */}
            {showEmbeds && followedContent.length > 0 && (
              <div className="embeds-demo">
                <h3>Content Embeds Demo</h3>
                {followedContent.map(item => (
                  <div key={item.id} className="embed-example">
                    <p>{item.content}</p>
                    <ContentEmbeds content={item.content} maxEmbeds={3} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="no-following">
            <p>You're not following anyone yet.</p>
            <p>Follow some Nostr users to see their blog posts here.</p>
          </div>
        )
      ) : (
        <p>Connect to see blogs from people you follow</p>
      )}
    </div>
  );

  const renderCreateContent = () => (
    <div className="create-blog-container">
      <h2>Create New Blog Post</h2>
      <p>Write and publish your own long-form content to the Nostr network</p>
      <div className="coming-soon">
        <p>Coming soon!</p>
      </div>
    </div>
  );

  return (
    <div className="snailsfeed-container">
      <div className="snailsfeed-sidebar left">
        <div className="snailsfeed-section">
          <ProfileCard />
        </div>
        
        <div className="snailsfeed-section">
          <h3 className="section-title">Trending Hashtags</h3>
          <TrendingHashtags />
        </div>
      </div>
      
      <main className="snailsfeed-main">
        <div className="snailsfeed-section main-card merged-card">
          <div className="feed-tabs">
            <button 
              className={`tab-button ${activeTab === 'latest' ? 'active' : ''}`}
              onClick={() => handleTabChange('latest')}
            >
              Latest
            </button>
            <button 
              className={`tab-button ${activeTab === 'popular' ? 'active' : ''}`}
              onClick={() => handleTabChange('popular')}
            >
              Popular
            </button>
            <button 
              className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => handleTabChange('following')}
            >
              Following
            </button>
            <button 
              className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => handleTabChange('create')}
            >
              Create
            </button>
          </div>
        </div>
        
        {activeTab === 'latest' ? (
          renderLatestContent()
        ) : activeTab === 'popular' ? (
          renderPopularContent()
        ) : activeTab === 'following' ? (
          renderFollowingContent()
        ) : (
          renderCreateContent()
        )}
      </main>
    </div>
  );
} 