import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Note } from '../components/Note';

interface SearchResult {
  users: Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>;
  hashtags: Array<{tag: string; count: number}>;
  posts: NDKEvent[];
}

export function SearchResultsPage() {
  const location = useLocation();
  const { searchNostr } = useNostrContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const performSearch = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      // Increase the limit for the full search page
      const searchResults = await searchNostr(searchQuery, 50);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchNostr]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryParam = searchParams.get('q') || '';
    setQuery(queryParam);
    
    if (queryParam.length > 0) {
      performSearch(queryParam);
    }
  }, [location.search, performSearch]);

  // Helper function to organize users by NIP-05 verification
  const getCategorizedUsers = (users: Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>) => {
    const verifiedUsers = users.filter(user => user.nip05);
    const nonVerifiedUsers = users.filter(user => !user.nip05);
    
    return {
      verified: verifiedUsers,
      nonVerified: nonVerifiedUsers
    };
  };

  // Render each user card
  const renderUserCard = (user: {pubkey: string; name: string; displayName: string; picture: string; nip05: string}, isVerified: boolean) => {
    return (
      <div key={user.pubkey} className="search-user-card">
        <div className="search-user-avatar">
          {user.picture ? (
            <img src={user.picture} alt={user.displayName || user.name} />
          ) : (
            <div className="default-avatar medium"></div>
          )}
        </div>
        <div className="search-user-info">
          <div className="search-user-name">
            {user.displayName || user.name || 'Anonymous'}
            {isVerified && (
              <span className="verified-badge" title="NIP-05 Verified">✓</span>
            )}
          </div>
          <div className="search-user-handle">
            {isVerified ? user.nip05 : `@${user.pubkey.substring(0, 8)}...`}
          </div>
        </div>
        <button className="search-follow-button">Follow</button>
      </div>
    );
  };

  // Render content based on active tab
  const renderTabContent = () => {
    if (!results) return null;

    switch (activeTab) {
      case 'all':
        return (
          <>
            {/* Show abbreviated user section */}
            {results.users.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-heading">
                  Users 
                  <span className="search-count-badge">{results.users.length}</span>
                  <button 
                    className="search-view-more" 
                    onClick={() => setActiveTab('users')}
                  >
                    View All
                  </button>
                </h3>
                <div className="search-user-grid">
                  {getCategorizedUsers(results.users).verified.slice(0, 3).map(user => renderUserCard(user, true))}
                  {getCategorizedUsers(results.users).nonVerified.slice(0, 3).map(user => renderUserCard(user, false))}
                </div>
              </div>
            )}

            {/* Show hashtags */}
            {results.hashtags.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-heading">
                  Hashtags
                  <span className="search-count-badge">{results.hashtags.length}</span>
                  <button 
                    className="search-view-more" 
                    onClick={() => setActiveTab('hashtags')}
                  >
                    View All
                  </button>
                </h3>
                <div className="search-hashtag-grid">
                  {results.hashtags.slice(0, 12).map(hashtag => (
                    <div key={hashtag.tag} className="search-hashtag-card">
                      <div className="hashtag-name">#{hashtag.tag}</div>
                      <div className="hashtag-count">{hashtag.count} posts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show posts */}
            {results.posts.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-heading">
                  Posts
                  <span className="search-count-badge">{results.posts.length}</span>
                  <button 
                    className="search-view-more" 
                    onClick={() => setActiveTab('posts')}
                  >
                    View All
                  </button>
                </h3>
                <div className="search-posts-list">
                  {results.posts.slice(0, 5).map(post => (
                    <Note key={post.id} event={post} />
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case 'users':
        return (
          <div className="search-section">
            <h3 className="search-section-heading">
              Verified Users (NIP-05)
              <span className="search-count-badge">{getCategorizedUsers(results.users).verified.length}</span>
            </h3>
            <div className="search-user-grid">
              {getCategorizedUsers(results.users).verified.map(user => renderUserCard(user, true))}
            </div>

            <h3 className="search-section-heading">
              Users
              <span className="search-count-badge">{getCategorizedUsers(results.users).nonVerified.length}</span>
            </h3>
            <div className="search-user-grid">
              {getCategorizedUsers(results.users).nonVerified.map(user => renderUserCard(user, false))}
            </div>
          </div>
        );

      case 'hashtags':
        return (
          <div className="search-section">
            <h3 className="search-section-heading">
              Hashtags
              <span className="search-count-badge">{results.hashtags.length}</span>
            </h3>
            <div className="search-hashtag-grid">
              {results.hashtags.map(hashtag => (
                <div key={hashtag.tag} className="search-hashtag-card">
                  <div className="hashtag-name">#{hashtag.tag}</div>
                  <div className="hashtag-count">{hashtag.count} posts</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'posts':
        return (
          <div className="search-section">
            <h3 className="search-section-heading">
              Posts
              <span className="search-count-badge">{results.posts.length}</span>
            </h3>
            <div className="search-posts-list">
              {results.posts.map(post => (
                <Note key={post.id} event={post} />
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="search-results-page">
      <div className="search-header">
        <h2 className="search-title">
          Search Results for: <span className="search-query">"{query}"</span>
        </h2>
        <div className="search-meta">
          {results && (
            <div className="search-stats">
              {results.users.length + results.hashtags.length + results.posts.length} results found
            </div>
          )}
        </div>
      </div>

      <div className="search-tabs">
        <button 
          className={`search-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button 
          className={`search-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
          {results && (
            <span className="tab-count">{results.users.length}</span>
          )}
        </button>
        <button 
          className={`search-tab ${activeTab === 'hashtags' ? 'active' : ''}`}
          onClick={() => setActiveTab('hashtags')}
        >
          Hashtags
          {results && (
            <span className="tab-count">{results.hashtags.length}</span>
          )}
        </button>
        <button 
          className={`search-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
          {results && (
            <span className="tab-count">{results.posts.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="search-loading">
          <div className="loading-spinner"></div>
          <p>Searching for "{query}"...</p>
        </div>
      ) : (
        <div className="search-content">
          {renderTabContent()}
          
          {results && results.users.length === 0 && results.hashtags.length === 0 && results.posts.length === 0 && (
            <div className="no-results-container">
              <h3>No results found for "{query}"</h3>
              <p>Try adjusting your search terms or explore trending topics instead.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 