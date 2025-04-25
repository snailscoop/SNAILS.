import { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

interface RefreshButtonProps {
  onRefresh: () => void;
}

export function RefreshButton({ onRefresh }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    
    // Reset refreshing state after animation
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };
  
  return (
    <div className="notification-container">
      <button 
        className={`notification-bell ${isRefreshing ? 'refreshing' : ''}`}
        onClick={handleRefresh}
        aria-label="Refresh Feed"
        title="Refresh Feed"
      >
        <FiRefreshCw size={20} className={isRefreshing ? 'spin' : ''} />
      </button>
    </div>
  );
} 