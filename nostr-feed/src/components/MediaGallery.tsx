import { useState } from 'react';

export interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'gif';
  thumbnailUrl?: string;
}

interface MediaGalleryProps {
  items: MediaItem[];
}

export function MediaGallery({ items }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  if (!items || items.length === 0) {
    return null;
  }
  
  // Determine grid layout based on number of items
  const getGridClass = () => {
    switch (items.length) {
      case 1: return 'media-gallery-single';
      case 2: return 'media-gallery-two';
      case 3: return 'media-gallery-three';
      case 4: return 'media-gallery-four';
      default: return 'media-gallery-many';
    }
  };
  
  // Render media item
  const renderMediaItem = (item: MediaItem, index: number) => {
    switch (item.type) {
      case 'image':
      case 'gif':
        return (
          <div 
            className="media-gallery-item" 
            key={`${item.url}-${index}`}
            onClick={() => setSelectedIndex(index)}
          >
            <img 
              src={item.thumbnailUrl || item.url} 
              alt="" 
              loading="lazy"
            />
            {items.length > 4 && index === 3 && (
              <div className="media-gallery-more">
                <span>+{items.length - 4}</span>
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <div 
            className="media-gallery-item" 
            key={`${item.url}-${index}`}
            onClick={() => setSelectedIndex(index)}
          >
            <div className="media-gallery-video-thumbnail">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <div className="media-gallery-video-placeholder">
                  <span>▶️</span>
                </div>
              )}
              <div className="media-gallery-play-icon">▶</div>
            </div>
            {items.length > 4 && index === 3 && (
              <div className="media-gallery-more">
                <span>+{items.length - 4}</span>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };
  
  // Full-screen modal for viewing media
  const renderModal = () => {
    if (selectedIndex === null) return null;
    
    const item = items[selectedIndex];
    
    return (
      <div className="media-gallery-modal" onClick={() => setSelectedIndex(null)}>
        <div className="media-gallery-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="media-gallery-close" onClick={() => setSelectedIndex(null)}>×</button>
          
          <div className="media-gallery-modal-display">
            {item.type === 'video' ? (
              <video controls autoPlay>
                <source src={item.url} />
                Your browser does not support the video tag.
              </video>
            ) : (
              <img src={item.url} alt="" />
            )}
          </div>
          
          {items.length > 1 && (
            <div className="media-gallery-navigation">
              <button 
                className="media-gallery-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(prev => prev === 0 ? items.length - 1 : prev! - 1);
                }}
              >
                ‹
              </button>
              <div className="media-gallery-indicator">
                {selectedIndex + 1} / {items.length}
              </div>
              <button 
                className="media-gallery-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(prev => prev === items.length - 1 ? 0 : prev! + 1);
                }}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className={`media-gallery ${getGridClass()}`}>
      {/* Only show first 4 items in the grid */}
      {items.slice(0, 4).map((item, index) => renderMediaItem(item, index))}
      {renderModal()}
    </div>
  );
} 