import { useEffect, useState, useCallback } from 'react';
import '../App.css';
import { useNostrContext } from '../contexts/useNostrContext';

interface UserVideosListProps {
  pubkey: string;
  limit?: number;
  className?: string;
}

export function UserVideosList({ pubkey, limit = 3, className = '' }: UserVideosListProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchVideos } = useNostrContext();

  // Use a callback to create a stable function reference
  const fetchUserVideos = useCallback(async () => {
    if (!pubkey) return;
    
    setLoading(true);
    try {
      const videoEvents = await fetchVideos(pubkey, limit);
      setVideos(videoEvents || []);
    } catch (error) {
      console.error('Error fetching user videos:', error);
    } finally {
      setLoading(false);
    }
  }, [pubkey, limit, fetchVideos]);

  useEffect(() => {
    fetchUserVideos();
    // Only run this effect once when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, limit]);

  if (loading) {
    return (
      <div className={`user-videos-loading ${className}`}>
        <div className="loading-spinner"></div>
        <p>Loading videos...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={`user-videos-empty ${className}`}>
        <p>No recent videos</p>
      </div>
    );
  }

  return (
    <div className={`user-videos-list ${className}`}>
      {videos.map((video) => (
        <div key={video.id} className="user-video-item">
          <div className="video-header">
            <div className="video-author">
              {video.authorName || 'Anonymous'}
            </div>
          </div>
          <div className="video-content">
            <p>{video.content}</p>
            {video.thumbnail && (
              <div className="video-thumbnail">
                <img src={video.thumbnail} alt="Video thumbnail" />
              </div>
            )}
          </div>
          <div className="video-meta">
            {new Date(video.created_at * 1000).toLocaleString()}
          </div>
        </div>
      ))}
      
      {videos.length > 0 && (
        <div className="view-more-container">
          <button className="view-more-button">
            View All Videos
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
} 