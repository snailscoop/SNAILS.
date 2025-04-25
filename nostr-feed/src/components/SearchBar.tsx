import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { createPortal } from 'react-dom';

interface SearchResult {
  users: Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>;
  hashtags: Array<{tag: string; count: number}>;
  posts: NDKEvent[];
}

export function SearchBar() {
  const { searchNostr, encodePublicKey } = useNostrContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Calculate and set dropdown position when results are shown
  useEffect(() => {
    if (showResults && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [showResults]);

  // Handle click outside to close search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search function
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const searchResults = await searchNostr(query);
          setResults(searchResults);
          setShowResults(true);
        } catch (error) {
          console.error('Search error:', error);
          setResults(null);
        } finally {
          setLoading(false);
        }
      } else {
        setResults(null);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [query, searchNostr]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      setShowResults(true);
    }
  };

  const navigateToProfile = (pubkey: string) => {
    const npub = encodePublicKey(pubkey);
    navigate(`/profile/${npub}`);
    setShowResults(false);
    setQuery('');
  };

  const navigateToTag = (tag: string) => {
    navigate(`/tag/${tag}`);
    setShowResults(false);
    setQuery('');
  };

  const navigateToPost = (event: NDKEvent) => {
    navigate(`/post/${event.id}`);
    setShowResults(false);
    setQuery('');
  };

  // Helper function to organize users by NIP-05 verification
  const getCategorizedUsers = (users: Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>) => {
    // Separate users with NIP-05 verification from those without
    const verifiedUsers = users.filter(user => user.nip05);
    const nonVerifiedUsers = users.filter(user => !user.nip05);
    
    // Get top 5 of each category
    return {
      verified: verifiedUsers.slice(0, 5),
      nonVerified: nonVerifiedUsers.slice(0, 5)
    };
  };

  // Create the search results dropdown
  const renderSearchResults = () => {
    if (!showResults) return null;
    
    return createPortal(
      <div 
        className="search-results" 
        style={{
          position: 'fixed',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${Math.max(dropdownPosition.width, 500)}px`,
          maxWidth: '90vw',
          maxHeight: '600px',
          zIndex: 100000,
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
          background: 'rgba(10, 26, 51, 0.95)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {loading ? (
          <div className="search-loading">Searching...</div>
        ) : results ? (
          <div className="search-results-content">
            {/* NIP-05 Verified Users section */}
            {results.users.length > 0 && getCategorizedUsers(results.users).verified.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Verified Users (NIP-05)</h4>
                <ul className="search-section-list">
                  {getCategorizedUsers(results.users).verified.map((user) => (
                    <li 
                      key={user.pubkey} 
                      className="search-result-item user-result"
                      onClick={() => navigateToProfile(user.pubkey)}
                    >
                      <div className="user-avatar-small">
                        {user.picture ? (
                          <img src={user.picture} alt={user.displayName || user.name} />
                        ) : (
                          <div className="default-avatar small"></div>
                        )}
                      </div>
                      <div className="user-info-small">
                        <span className="user-name">
                          {user.displayName || user.name || 'Anonymous'}
                        </span>
                        <span className="user-handle">
                          {user.nip05}
                        </span>
                      </div>
                      <div className="verified-badge-container">
                        <span className="verified-badge" title="NIP-05 Verified">✓</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Non-Verified Users section */}
            {results.users.length > 0 && getCategorizedUsers(results.users).nonVerified.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Users</h4>
                <ul className="search-section-list">
                  {getCategorizedUsers(results.users).nonVerified.map((user) => (
                    <li 
                      key={user.pubkey} 
                      className="search-result-item user-result"
                      onClick={() => navigateToProfile(user.pubkey)}
                    >
                      <div className="user-avatar-small">
                        {user.picture ? (
                          <img src={user.picture} alt={user.displayName || user.name} />
                        ) : (
                          <div className="default-avatar small"></div>
                        )}
                      </div>
                      <div className="user-info-small">
                        <span className="user-name">
                          {user.displayName || user.name || 'Anonymous'}
                        </span>
                        <span className="user-handle">
                          {`@${user.pubkey.substring(0, 8)}...`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hashtags section - show top 5 */}
            {results.hashtags.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Hashtags</h4>
                <ul className="search-section-list">
                  {results.hashtags.slice(0, 5).map((hashtag) => (
                    <li 
                      key={hashtag.tag} 
                      className="search-result-item hashtag-result"
                      onClick={() => navigateToTag(hashtag.tag)}
                    >
                      <span className="hashtag-icon">#</span>
                      <span className="hashtag-name">{hashtag.tag}</span>
                      <span className="hashtag-count">{hashtag.count} posts</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Posts section - show top 5 */}
            {results.posts.length > 0 && (
              <div className="search-section">
                <h4 className="search-section-title">Posts</h4>
                <ul className="search-section-list">
                  {results.posts.slice(0, 5).map((post) => (
                    <li 
                      key={post.id} 
                      className="search-result-item post-result"
                      onClick={() => navigateToPost(post)}
                    >
                      <div className="post-content">
                        {post.content.length > 100 
                          ? `${post.content.substring(0, 100)}...` 
                          : post.content}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.users.length === 0 && results.hashtags.length === 0 && results.posts.length === 0 && (
              <div className="no-results">No results found for "{query}"</div>
            )}
            
            {/* Show view all results option if there are more results */}
            {(results.users.length > 10 || results.hashtags.length > 5 || results.posts.length > 5) && (
              <div className="view-all-results">
                <button 
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
                  className="view-all-button"
                >
                  View all results
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>,
      document.body
    );
  };

  return (
    <div className="search-container" ref={searchRef}>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-container">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search SNAILS."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results && query.length >= 2) {
                setShowResults(true);
              }
            }}
          />
          {query && (
            <button 
              type="button" 
              className="clear-search"
              onClick={() => {
                setQuery('');
                setShowResults(false);
                setResults(null);
              }}
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {renderSearchResults()}
    </div>
  );
} 