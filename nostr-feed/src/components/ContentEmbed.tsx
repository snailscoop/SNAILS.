import { useState, useEffect } from 'react';
import { EmbedData } from '../utils/urlEmbed';
import { EmbeddedNote } from './EmbeddedNote';

interface ContentEmbedProps {
  embed: EmbedData;
}

// Simple Link Preview component
function LinkPreview({ url }: { url: string }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Extract domain and path from URL
  let domain = '';
  let path = '';
  
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
    path = urlObj.pathname;
  } catch {
    console.error('Invalid URL:', url);
    domain = url;
  }
  
  // For now, use favicon from the domain
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;
  
  useEffect(() => {
    // In a real implementation, you would fetch metadata from the URL
    try {
      // Generate a title from the path - remove dashes, extract meaningful parts
      let generatedTitle = '';
      
      if (path && path.length > 1) {
        const lastSegment = path.split('/').filter(Boolean).pop() || '';
        
        if (lastSegment) {
          // Convert dashes and underscores to spaces
          generatedTitle = lastSegment
            .replace(/[-_]/g, ' ')
            .replace(/\.html$|\.php$|\.asp$|\.aspx$/i, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
      
      setTitle(generatedTitle || domain);
      setDescription(`Visit ${domain} to learn more`);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating link preview:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [url, domain, path]);
  
  if (isLoading) {
    return <div className="link-preview-loading">Loading preview...</div>;
  }
  
  if (hasError) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="link-fallback">
        {url}
      </a>
    );
  }
  
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link-preview">
      <div className="link-preview-content">
        <div className="link-preview-icon">
          <img src={faviconUrl} alt="" width="16" height="16" />
        </div>
        <div className="link-preview-info">
          <div className="link-preview-title">{title}</div>
          <div className="link-preview-description">{description}</div>
          <div className="link-preview-url">{domain}</div>
        </div>
      </div>
    </a>
  );
}

export function ContentEmbed({ embed }: ContentEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset states when embed changes
    setIsLoading(true);
    setHasError(false);
    
    // Simulate loading to avoid layout shifts
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [embed.url]);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  // Function to render embed based on type
  const renderEmbed = () => {
    if (isLoading) {
      return (
        <div className="embed-loading">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="embed-error">
          <a href={embed.url} target="_blank" rel="noopener noreferrer">
            {embed.platform || 'Link'}: {embed.url}
          </a>
        </div>
      );
    }

    switch (embed.type) {
      case 'youtube':
        return (
          <div className="embed-container youtube-embed">
            <iframe 
              width="100%" 
              height="315" 
              src={`https://www.youtube.com/embed/${embed.id}`}
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              title={`YouTube video ${embed.id}`}
              onError={handleError}
            ></iframe>
          </div>
        );
      
      case 'rumble':
        return (
          <div className="embed-container rumble-embed">
            <iframe 
              width="100%" 
              height="315" 
              src={`https://rumble.com/embed/v${embed.id}`}
              frameBorder="0" 
              allowFullScreen
              referrerPolicy="origin"
              title={`Rumble video ${embed.id}`}
              onError={handleError}
            ></iframe>
          </div>
        );
      
      case 'vimeo':
        return (
          <div className="embed-container vimeo-embed">
            <iframe 
              width="100%" 
              height="315" 
              src={`https://player.vimeo.com/video/${embed.id}`}
              frameBorder="0" 
              allow="autoplay; fullscreen; picture-in-picture" 
              allowFullScreen
              title={`Vimeo video ${embed.id}`}
              onError={handleError}
            ></iframe>
          </div>
        );
      
      case 'streamable':
        return (
          <div className="embed-container streamable-embed">
            <iframe 
              width="100%" 
              height="315" 
              src={`https://streamable.com/e/${embed.id}`}
              frameBorder="0" 
              allowFullScreen
              title={`Streamable video ${embed.id}`}
              onError={handleError}
            ></iframe>
          </div>
        );
      
      case 'spotify':
        // Determine height based on content type from embed URL
        let height = 80; // Default for tracks
        if (embed.embedUrl?.includes('/album/')) {
          height = 380;
        } else if (embed.embedUrl?.includes('/playlist/')) {
          height = 380;
        } else if (embed.embedUrl?.includes('/episode/')) {
          height = 232;
        }
        
        // Make sure we have a valid embed URL
        if (!embed.embedUrl) {
          return (
            <div className="embed-error">
              <a href={embed.url} target="_blank" rel="noopener noreferrer">
                Failed to load Spotify content: {embed.url}
              </a>
            </div>
          );
        }
        
        return (
          <div className="embed-container spotify-embed">
            <iframe 
              src={embed.embedUrl}
              width="100%" 
              height={height} 
              frameBorder="0" 
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={`Spotify ${embed.embedUrl.includes('/album/') ? 'album' : 
                        embed.embedUrl.includes('/playlist/') ? 'playlist' : 
                        embed.embedUrl.includes('/episode/') ? 'podcast' : 'track'}`}
              onError={handleError}
              style={{ borderRadius: '12px' }}
            ></iframe>
          </div>
        );
      
      case 'odysee':
        return (
          <div className="embed-container odysee-embed">
            <iframe 
              width="100%" 
              height="315" 
              src={`https://odysee.com/$/embed/${embed.id}`}
              frameBorder="0" 
              allowFullScreen
              title={`Odysee video ${embed.id}`}
              onError={handleError}
            ></iframe>
          </div>
        );
      
      case 'twitter':
        return (
          <div className="embed-container twitter-embed">
            <blockquote className="twitter-tweet">
              <a href={embed.url} target="_blank" rel="noopener noreferrer">View tweet</a>
            </blockquote>
            {/* Twitter embed script would be loaded separately */}
          </div>
        );
      
      case 'nostr-event':
        return (
          <div className="embed-container nostr-event-embed">
            {embed.noteId ? (
              <EmbeddedNote noteId={embed.noteId} />
            ) : (
              <div className="embed-error">
                Failed to parse Nostr event ID
              </div>
            )}
          </div>
        );
      
      case 'image':
        return (
          <div className="embed-container image-embed">
            <img 
              src={embed.url} 
              alt="Embedded content" 
              onError={handleError}
              loading="lazy"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="embed-container video-embed">
            <video 
              controls 
              width="100%" 
              src={embed.url}
              onError={handleError}
            />
          </div>
        );
      
      case 'audio':
        return (
          <div className="embed-container audio-embed">
            <audio 
              controls 
              src={embed.url}
              onError={handleError} 
            />
          </div>
        );
      
      case 'catbox': {
        // Determine how to handle Catbox based on URL extension
        const extension = embed.url.split('.').pop()?.toLowerCase();
        const isImage = extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
        const isVideo = extension && ['mp4', 'webm', 'ogg', 'mov'].includes(extension);
        const isAudio = extension && ['mp3', 'wav', 'ogg', 'flac'].includes(extension);
        
        if (isImage) {
          return (
            <div className="embed-container catbox-image-embed">
              <img 
                src={embed.url} 
                alt="Catbox image" 
                onError={handleError}
                loading="lazy"
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          );
        } else if (isVideo) {
          return (
            <div className="embed-container catbox-video-embed">
              <video 
                controls 
                width="100%" 
                src={embed.url}
                onError={handleError}
              />
            </div>
          );
        } else if (isAudio) {
          return (
            <div className="embed-container catbox-audio-embed">
              <audio 
                controls 
                src={embed.url}
                onError={handleError} 
              />
            </div>
          );
        } else {
          return (
            <div className="embed-container catbox-link">
              <a href={embed.url} target="_blank" rel="noopener noreferrer">
                Catbox file: {embed.url.split('/').pop()}
              </a>
            </div>
          );
        }
      }
      
      case 'url':
        return (
          <div className="embed-container url-embed">
            <LinkPreview url={embed.url} />
          </div>
        );
      
      default:
        return (
          <div className="embed-container generic-embed">
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              {embed.url}
            </a>
          </div>
        );
    }
  };

  return (
    <div className={`content-embed ${embed.type}-content`}>
      {renderEmbed()}
    </div>
  );
} 