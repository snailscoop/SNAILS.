import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Feed } from '../components/Feed';
import { useNostrContext } from '../contexts/useNostrContext';
import { ProfileCard } from '../components/ProfileCard';
import { RecommendedFollows } from '../components/RecommendedFollows';
import { TrendingHashtags } from '../components/TrendingHashtags';

export function SnailsFeedPage() {
  const { isConnected, isLoading, publishNote, currentUser, fetchContactList } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create a filter with a timestamp to avoid fetching the entire history
  const feedFilter = useMemo(() => {
    // Get events from the last 24 hours
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    return {
      since: oneDayAgo,
      limit: 50
    };
  }, []);

  // Create a filter for the following feed
  const followingFilter = useMemo(() => {
    // Get events from the last 7 days for following feed to ensure content
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    return {
      authors: contacts,
      since: sevenDaysAgo,
      limit: 50
    };
  }, [contacts]);

  // Fetch contacts when user loads the page or changes tab to following
  useEffect(() => {
    const loadContacts = async () => {
      if (isConnected && currentUser && activeTab === 'following') {
        setIsLoadingContacts(true);
        try {
          const userContacts = await fetchContactList();
          setContacts(userContacts);
        } catch (error) {
          console.error('Failed to fetch contacts:', error);
        } finally {
          setIsLoadingContacts(false);
        }
      }
    };

    loadContacts();
  }, [isConnected, currentUser, fetchContactList, activeTab]);

  // Handle tab change
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    // Reset refresh key when changing tabs
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleNotePublished = async () => {
    if (!currentUser || isPublishing || !content.trim()) {
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const event = await publishNote(content);
      
      if (event) {
        setContent('');
        setAttachments([]);
        // Refresh the feed
        setRefreshKey(prev => prev + 1);
      } else {
        setError('Failed to publish note. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while publishing your note.');
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Force refresh the feed
    setRefreshKey(prev => prev + 1);
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // In a real implementation, you would upload these files to a server
    // For this demo, we'll create object URLs to display them
    const newAttachments = Array.from(files).map(file => URL.createObjectURL(file));
    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(newAttachments[index]);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const imageUrl = URL.createObjectURL(file);
          setAttachments(prev => [...prev, imageUrl]);
        }
      }
    }
  };

  const renderFeedContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    return (
      <Feed key={refreshKey} filter={feedFilter} limit={50} />
    );
  };

  const renderFollowingContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div className="login-message">
          <p>You need to log in to see posts from people you follow</p>
        </div>
      );
    }

    if (isLoadingContacts) {
      return (
        <div className="loading-container">
          <p>Loading your contacts...</p>
        </div>
      );
    }

    if (contacts.length === 0) {
      return (
        <div className="following-empty">
          <p>You're not following anyone yet.</p>
          <p>Explore users and follow them to see their posts here.</p>
        </div>
      );
    }

    return (
      <Feed key={`following-${refreshKey}`} filter={followingFilter} limit={50} />
    );
  };

  return (
    <div className="snailsfeed-container">
      <div className="snailsfeed-sidebar left">
        <div className="snailsfeed-section">
          <ProfileCard />
        </div>
      </div>
      
      <main className="snailsfeed-main">
        <div className="snailsfeed-section main-card merged-card">
          <div className="compose-area">
            <div className="feed-tabs">
              <button 
                className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => handleTabChange('following')}
              >
                Following
              </button>
              <button 
                className={`tab-button ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => handleTabChange('feed')}
              >
                Feed
              </button>
              <button 
                className={`tab-button ${activeTab === 'explore' ? 'active' : ''}`}
                onClick={() => handleTabChange('explore')}
              >
                Explore
              </button>
            </div>
            
            <textarea
              placeholder="What's happening?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              maxLength={280}
              className="compose-textarea"
              disabled={isPublishing || isLoading || !currentUser}
            />
            
            {attachments.length > 0 && (
              <div className="snails-attachments-preview">
                {attachments.map((url, index) => (
                  <div key={index} className="snails-attachment-item">
                    <img src={url} alt="attachment" />
                    <button 
                      className="snails-remove-attachment" 
                      onClick={() => removeAttachment(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="snails-compose-footer">
              <div className="snails-compose-actions">
                <button 
                  onClick={handleAttachImage} 
                  className="snails-attach-button"
                  disabled={isPublishing || isLoading || !currentUser}
                >
                  <i className="fa fa-image"></i>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelected} 
                  accept="image/*" 
                  multiple 
                  style={{ display: 'none' }} 
                />
                <div className="snails-char-count">
                  {content.length}/280
                </div>
              </div>
              <button
                onClick={handleNotePublished}
                disabled={isPublishing || isLoading || !currentUser || (!content.trim() && attachments.length === 0)}
                className="snails-cyber-send-button"
              >
                {isPublishing ? 'Sending...' : 'Send'}
              </button>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {!currentUser && !isLoading && (
              <div className="login-message">
                You need to log in to publish notes
              </div>
            )}
          </div>
        </div>
        
        {activeTab === 'feed' ? (
          <div className="feed-wrapper">
            <div className="feed-header">
              <h2>Global Feed</h2>
              <button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="refresh-button"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {renderFeedContent()}
          </div>
        ) : activeTab === 'following' ? (
          <div className="feed-wrapper">
            <div className="feed-header">
              <h2>Following Feed</h2>
              <button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="refresh-button"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {renderFollowingContent()}
          </div>
        ) : (
          <div className="explore-container">
            <h2>Explore Nostr</h2>
            <p>Discover trending content and popular users</p>
            
            <div className="explore-grid">
              <div className="explore-column">
                <h3>Popular Hashtags</h3>
                <TrendingHashtags />
              </div>
              
              <div className="explore-column">
                <h3>Recommended Follows</h3>
                <RecommendedFollows />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 