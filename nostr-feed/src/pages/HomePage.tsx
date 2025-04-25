import { useState } from 'react';
import { Feed } from '../components/Feed';
import { ComposeNote } from '../components/ComposeNote';
import { Login } from '../components/Login';
import { RightSidebar } from '../components/RightSidebar';
import { useNostrContext } from '../contexts/useNostrContext';

export function HomePage() {
  const { isConnected, isLoading } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNotePublished = () => {
    // Force refresh the feed when a new note is published
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app-layout">
      <main className="main-content">
        <div className="page-title">
          <h2>Home Feed</h2>
        </div>
        
        <ComposeNote onSuccess={handleNotePublished} />
        
        {isLoading && !isConnected ? (
          <div className="loading-container">
            <p>Connecting to Nostr network...</p>
          </div>
        ) : (
          <div className="feed-wrapper">
            <Feed key={refreshKey} limit={50} />
          </div>
        )}
      </main>
      
      <RightSidebar />
      
      {!isConnected && (
        <div className="floating-login">
          <Login />
        </div>
      )}
    </div>
  );
} 