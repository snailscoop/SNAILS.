import { SuggestedUsers } from './SuggestedUsers';
import { TrendingHashtags } from './TrendingHashtags';
import { SearchBar } from './SearchBar';

export function RightSidebar() {
  return (
    <div className="right-sidebar">
      <div className="search-section">
        <SearchBar />
      </div>
      <div className="sidebar-section">
        <TrendingHashtags />
      </div>
      <div className="sidebar-section">
        <SuggestedUsers />
      </div>
      <div className="sidebar-footer">
        <div className="footer-links">
          <a href="https://github.com/nostr-protocol/nostr" target="_blank" rel="noopener noreferrer">About</a>
          <a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener noreferrer">NIPs</a>
          <a href="#" rel="noopener noreferrer">Privacy</a>
          <a href="#" rel="noopener noreferrer">Terms</a>
        </div>
        <div className="footer-text">
          © 2023 SNAILS.feed
        </div>
      </div>
    </div>
  );
} 