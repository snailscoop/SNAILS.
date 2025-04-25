import { useState } from 'react';
import { SlideNav } from './SlideNav';
import { NotificationBell } from './NotificationBell';
import { RefreshButton } from './RefreshButton';
import { useNostrContext } from '../contexts/useNostrContext';

export function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { isConnected } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const handleRefresh = () => {
    // Increment refresh key to trigger feed refresh
    setRefreshKey(prev => prev + 1);
    // Publish refresh event for components to listen to
    const refreshEvent = new CustomEvent('feed-refresh', { detail: { key: refreshKey } });
    window.dispatchEvent(refreshEvent);
  };

  return (
    <header className="main-header">
      <div className="menu-button" onClick={toggleNav} style={{ cursor: 'pointer' }}>
      <img 
          src="/Logo.png" 
          alt="SNAILS Logo"
          className="menu-logo"
          style={{ 
            height: '50px', 
            width: 'auto',
            filter: 'drop-shadow(0 0 8px rgba(231, 76, 60, 0.8))'
          }} 
        />
      </div>
      
      {isConnected && (
        <div className="header-right">
          <RefreshButton onRefresh={handleRefresh} />
          <NotificationBell />
        </div>
      )}
      
      <SlideNav isOpen={isNavOpen} toggleNav={toggleNav} />
    </header>
  );
} 