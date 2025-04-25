import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { TrendingHashtags } from '../components/TrendingHashtags';
import { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { ProfileCard } from '../components/ProfileCard';

// Nostr kinds for media content
// Define custom type for NIP-53 kind to avoid using 'any'
type NostrKind = number;
const NOSTR_KIND_LIVESTREAM: NostrKind = 30311;       // NIP-53 Live Streaming Metadata
const NOSTR_KIND_HIGHLIGHT = 1063;         // Video Highlight
const NOSTR_KIND_REGULAR_NOTE = 1;         // Regular Note
const NOSTR_KIND_ARTICLE = 30023;          // Long-form Content

// Define a type for our filter that includes hashtag properties
type NostrFilter = Omit<NDKFilter, 'kinds'> & {
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  '#status'?: string[];
  [key: string]: unknown;
}

// VideoPlayer component to display a selected video
const VideoPlayer = ({ event, onClose }: { event: NDKEvent, onClose: () => void }) => {
  // Extract video metadata from tags
  const titleTag = event.tags.find(tag => tag[0] === 'title');
  const title = titleTag 
    ? titleTag[1] 
    : event.tags.find(tag => tag[0] === 'name')?.[1] 
    || event.tags.find(tag => tag[0] === 'subject')?.[1]
    || 'Untitled Video';
  
  // Try to find a video URL from various sources
  const videoUrl = useMemo(() => {
    // First check for URL tag
    const urlTag = event.tags.find(tag => tag[0] === 'url');
    if (urlTag && urlTag[1]) return urlTag[1];
    
    // Then check for media tag
    const mediaTag = event.tags.find(tag => tag[0] === 'media');
    if (mediaTag && mediaTag[1]) return mediaTag[1];
    
    // Check for embedded URLs in content
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const contentUrls = event.content.match(urlRegex);
    
    if (contentUrls && contentUrls.length > 0) {
      // Look for video-like URLs
      const videoExtensions = ['.mp4', '.mov', '.webm', '.m3u8'];
      const videoUrlPatterns = ['youtube.com/watch', 'youtu.be/', 'vimeo.com/', 'stream', 'video'];
      
      // First search for direct video files
      for (const url of contentUrls) {
        if (videoExtensions.some(ext => url.toLowerCase().includes(ext))) {
          return url;
        }
      }
      
      // Then check for video platforms
      for (const url of contentUrls) {
        if (videoUrlPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
          return url;
        }
      }
      
      // Fall back to first URL
      return contentUrls[0];
    }
    
    // If all else fails, return undefined
    return undefined;
  }, [event]);
  
  // Extract thumbnail
  const thumbTag = event.tags.find(tag => tag[0] === 'thumb');
  const thumbnail = thumbTag ? thumbTag[1] : '';
  
  // Extract other metadata
  const authorTag = event.tags.find(tag => tag[0] === 'p');
  const authorName = authorTag ? authorTag[1].slice(0, 10) + '...' : event.pubkey.slice(0, 10) + '...';

  // Handle closing the player
  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="video-player-overlay" onClick={handleClose}>
      <div className="video-player-container" onClick={e => e.stopPropagation()}>
        <div className="video-player-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        <div className="video-player-content">
          {videoUrl ? (
            <video 
              controls 
              autoPlay 
              poster={thumbnail}
              className="video-player"
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="no-video-source">
              <p>No video source found in this event.</p>
              <pre className="event-debug">
                {JSON.stringify({id: event.id, kind: event.kind, tags: event.tags}, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="video-player-description">
          <p>{event.content}</p>
          <div className="video-meta">
            <span className="video-author">Author: {authorName}</span>
            <span className="video-date">
              Posted: {new Date((event.created_at || 0) * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// VideoFeed component that will be implemented
const VideoFeed = ({ filter, limit = 15 }: { filter: NostrFilter, limit?: number }) => {
  const [videos, setVideos] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<NDKEvent | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const { subscribeToNotes } = useNostrContext();

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setDebugInfo('Starting to fetch videos...');
      
      try {
        // Create a filter for video events with proper constraints to avoid "No filters to merge" error
        const videoFilter = {
          kinds: [34235, 1063, 1, 30023], // Video kind, video highlight, regular notes, article
          limit: limit * 10, // Request more to account for filtering
          // Add a time constraint to avoid fetching the entire history
          since: Math.floor(Date.now() / 1000) - 7 * 86400, // Last week
          ...filter
        };
        
        // Ensure we always have at least one valid filter parameter
        if (!videoFilter.authors && !videoFilter['#e'] && !videoFilter['#p']) {
          console.log('No specific authors or events specified, using global feed with time constraints');
        }
        
        let receivedEvents = 0;
        let filteredEvents = 0;
        
        console.log('Subscribing with video filter:', videoFilter);
        
        // Helper function to convert NDKFilter to string[] expected by subscribeToNotes
        const subscribeWithFilter = async (filter: NostrFilter, limit: number, callback: (event: NDKEvent) => void) => {
          // If filter has authors, use them, otherwise pass an empty array
          const pubkeys = filter.authors || [];
          return subscribeToNotes(pubkeys, limit, callback);
        };
        
        // Subscribe to video events using our helper
        const subscription = await subscribeWithFilter(videoFilter, limit * 10, (event) => {
          receivedEvents++;
          setDebugInfo(`Received ${receivedEvents} events, kept ${filteredEvents} videos`);
          
          // Extremely lenient filtering for anything that might be a video
          const isVideoKind = event.kind === 34235 || event.kind === 1063;
          
          // Look for video-related terms in content
          const contentTerms = [
            'video', 'stream', 'watch', 'youtube', 'vimeo', 'twitch',
            'mp4', 'movie', 'clip', 'film', 'recording', 'zap.stream',
            'streaming', 'live', 'broadcast', 'tube', 'channel', 'camera'
          ];
          
          const hasVideoContentTerms = contentTerms.some(term => 
            event.content.toLowerCase().includes(term)
          );
          
          // Check for ANY media-like URL in any tag
          const hasMediaUrl = event.tags.some(tag => {
            if (!tag[1]) return false;
            const value = tag[1].toLowerCase();
            
            // Check for file extensions or video platforms
            return value.includes('.mp4') || 
                  value.includes('.mov') || 
                  value.includes('.webm') || 
                  value.includes('.m3u8') ||  // HLS stream
                  value.includes('youtube.com') ||
                  value.includes('youtu.be') ||
                  value.includes('vimeo.com') ||
                  value.includes('twitch.tv') ||
                  value.includes('stream') ||
                  value.includes('video') ||
                  value.includes('watch') ||
                  value.includes('tube');
          });
          
          // Check if event has any media-related tag
          const hasMediaTag = event.tags.some(tag => 
            ['video', 'media', 'url', 'stream', 'image', 'thumb', 'thumbnail', 
             'title', 'summary', 'article', 'h', 'm'].includes(tag[0])
          );
          
          // Super lenient check - accept anything that seems remotely video-like
          const isVideoLike = isVideoKind || hasMediaUrl || (hasVideoContentTerms && hasMediaTag);
          
          if (isVideoLike) {
            filteredEvents++;
            setDebugInfo(`Received ${receivedEvents} events, kept ${filteredEvents} videos`);
            
            // For debugging, log the video we're keeping
            console.log('Keeping video event:', {
              id: event.id,
              kind: event.kind,
              tags: event.tags,
              content: event.content.slice(0, 50) + '...'
            });
            
          setVideos(prev => {
            // Avoid duplicates
            if (prev.some(e => e.id === event.id)) return prev;
              
              // If we already have the limit, don't add more
              if (prev.length >= limit) return prev;
            
            // Add new video to list
              const newVideos = [...prev, event].sort((a, b) => 
              (b.created_at || 0) - (a.created_at || 0)
            );
              
              // Enforce limit
              return newVideos.slice(0, limit);
            });
          }
        });

        // Set loading to false after sufficient time
        setTimeout(() => {
          setLoading(false);
          if (filteredEvents === 0) {
            setDebugInfo(`Received ${receivedEvents} events, but none matched our video criteria. Using sample videos for testing.`);
            
            // If no videos found, create sample videos for testing
            if (videos.length === 0) {
              const sampleVideos = createSampleVideos(limit);
              setVideos(sampleVideos);
            }
          }
        }, 7000); // Longer timeout to allow more events to arrive

        return () => {
          subscription?.stop();
        };
      } catch (error) {
        console.error('Failed to fetch videos:', error);
        setLoading(false);
        setDebugInfo(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    fetchVideos();
  }, [filter, limit, subscribeToNotes, videos.length]);

  // Function to create sample videos for testing
  const createSampleVideos = (count: number) => {
    const sampleVideos: NDKEvent[] = [];
    
    // Sample video URLs from Nostr (Big Buck Bunny - open source test video)
    const videoUrls = [
      'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4'
    ];
    
    // Sample titles
    const titles = [
      'Big Buck Bunny',
      'Elephant\'s Dream',
      'For Bigger Blazes',
      'For Bigger Escapes',
      'For Bigger Fun',
      'For Bigger Joyrides',
      'For Bigger Meltdowns',
      'Sintel',
      'Subaru Outback On Street And Dirt',
      'Tears Of Steel',
      'Volkswagen GTI Review',
      'We Are Going On Bullrun',
      'What Car Can You Get For A Grand'
    ];
    
    // Sample thumbnails
    const thumbnails = [
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/VolkswagenGTIReview.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/WeAreGoingOnBullrun.jpg',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/images/WhatCarCanYouGetForAGrand.jpg'
    ];
    
    // Create sample videos
    for (let i = 0; i < Math.min(count, videoUrls.length); i++) {
      const mockEvent = new NDKEvent();
      mockEvent.id = `mock-event-${i}`;
      mockEvent.kind = 34235;
      mockEvent.pubkey = 'mock-pubkey';
      mockEvent.content = `This is a sample video for testing: ${titles[i]}. Open source movies from Blender Foundation.`;
      mockEvent.created_at = Math.floor(Date.now() / 1000) - i * 3600; // Spread out the timestamps
      mockEvent.tags = [
        ['title', titles[i]],
        ['url', videoUrls[i]],
        ['thumb', thumbnails[i]],
        ['p', 'mock-pubkey']
      ];
      
      sampleVideos.push(mockEvent);
    }
    
    return sampleVideos;
  };

  // Video card component
  const VideoCard = ({ event }: { event: NDKEvent }) => {
    // Extract video metadata from tags
    const titleTag = event.tags.find(tag => tag[0] === 'title');
    const title = titleTag ? titleTag[1] : 'Untitled Video';
    
    const thumbTag = event.tags.find(tag => tag[0] === 'thumb');
    const thumbnail = thumbTag ? thumbTag[1] : 'https://placehold.co/320x180?text=No+Thumbnail';
    
    const durationTag = event.tags.find(tag => tag[0] === 'duration');
    const duration = durationTag ? parseInt(durationTag[1]) : 0;
    
    // Check if this is a livestream
    const isLivestream = event.kind === 30311 || event.tags.some(tag => tag[0] === 'l' && tag[1] === 'true');
    
    // Format duration
    const formatDuration = (seconds: number) => {
      if (!seconds) return '--:--';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Use a memoized handler for video selection to prevent unnecessary re-renders
    const handleVideoSelect = (e: React.MouseEvent) => {
      e.preventDefault();
      setSelectedVideo(event);
    };

    return (
      <div className={`video-card ${isLivestream ? 'livestream' : ''}`} onClick={handleVideoSelect}>
        <div className="video-thumbnail">
          <img src={thumbnail} alt={title} loading="lazy" />
          {isLivestream ? (
            <span className="live-indicator">LIVE</span>
          ) : (
          <span className="video-duration">{formatDuration(duration)}</span>
          )}
        </div>
        <div className="video-info">
          <h3 className="video-title">{title}</h3>
          <p className="video-description">{event.content.slice(0, 100)}...</p>
          <div className="video-meta">
            <span className="video-author">{event.pubkey.slice(0, 10)}...</span>
            <span className="video-date">
              {isLivestream ? 'Streaming now' : new Date((event.created_at || 0) * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="video-feed">
      {loading ? (
        <div className="loading">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="no-videos">
          <p>No videos found</p>
          <p className="debug-info">{debugInfo}</p>
          <div className="suggest-relays">
            <p>Try connecting to these nostr video relays:</p>
            <ul>
              <li>wss://relay.zaps.stream</li>
              <li>wss://relay.nostr.band</li>
              <li>wss://relay.damus.io</li>
              <li>wss://nostr.mutinywallet.com</li>
              <li>wss://nos.lol</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="video-grid">
          {videos.slice(0, limit).map(video => (
            <VideoCard key={video.id} event={video} />
          ))}
        </div>
      )}
      
      {selectedVideo && (
        <VideoPlayer 
          event={selectedVideo} 
          onClose={() => setSelectedVideo(null)} 
        />
      )}
    </div>
  );
};

// LivestreamFeed component for showing top livestreams
const LivestreamFeed = ({ limit = 20 }: { limit?: number }) => {
  const [livestreams, setLivestreams] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<NDKEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const { subscribeLivestreams, getLivestreams, isConnected } = useNostrContext();
  const receivedStreamsRef = useRef<NDKEvent[]>([]);
  const streamTimesRef = useRef<Map<string, number>>(new Map());

  // Memoize livestreams to prevent unnecessary rerenders
  const memoizedLivestreams = useMemo(() => livestreams, [livestreams]);

  // Set isSearching to true when user is looking for a stream
  useEffect(() => {
    if (selectedStream) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [selectedStream]);

  useEffect(() => {
    const fetchLivestreams = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching livestreams from Nostr...');
        
        // Reset received streams but keep the time references
        receivedStreamsRef.current = [];
        
        // First try direct fetch to quickly populate the UI
        const initialStreams = await getLivestreams();
        if (initialStreams.length > 0) {
          console.log(`Got ${initialStreams.length} initial livestreams`);
          
          // Store start times
          initialStreams.forEach((stream: NDKEvent) => {
            const startsTag = stream.tags.find((tag: string[]) => tag[0] === 'starts');
            const startTime = startsTag ? parseInt(startsTag[1]) * 1000 : 
                           stream.created_at ? stream.created_at * 1000 : 
                           Date.now() - Math.floor(Math.random() * 3600000);
            streamTimesRef.current.set(stream.id, startTime);
          });
          
          receivedStreamsRef.current = initialStreams;
          updateLivestreams(initialStreams);
        }
        
        // Then subscribe for real-time updates
        subscriptionRef.current = await subscribeLivestreams((event: NDKEvent) => {
          // Check if the stream is actually live according to NIP-53
          const statusTags = event.tags.filter((tag: string[]) => tag[0] === 'status');
          const isCurrentlyLive = statusTags.some((tag: string[]) => tag[1].toLowerCase() === 'live');
          
          if (isCurrentlyLive) {
            // Add the event to our collection if it's not already there
            if (!receivedStreamsRef.current.some(s => s.id === event.id)) {
              // Store start time if we don't already have it
              if (!streamTimesRef.current.has(event.id)) {
                const startsTag = event.tags.find((tag: string[]) => tag[0] === 'starts');
                const startTime = startsTag ? parseInt(startsTag[1]) * 1000 : 
                               event.created_at ? event.created_at * 1000 : 
                               Date.now();
                streamTimesRef.current.set(event.id, startTime);
              }
              
              receivedStreamsRef.current.push(event);
              
              // Debounce the update to avoid frequent re-renders
              updateLivestreamsDebounced();
            }
          }
        });

        // Set loading to false after sufficient time
        const timer = setTimeout(() => {
          setLoading(false);
          
          // If no livestreams are found, provide sample data for testing
          if (receivedStreamsRef.current.length === 0) {
            console.log('No live streams found, creating samples');
            const sampleStreams = createSampleLivestreams(limit);
            
            // Store start times for sample streams
            sampleStreams.forEach(stream => {
              const startsTag = stream.tags.find(tag => tag[0] === 'starts');
              const startTime = startsTag ? parseInt(startsTag[1]) * 1000 : 
                              stream.created_at ? stream.created_at * 1000 : 
                              Date.now() - Math.floor(Math.random() * 3600000); // Random time in the last hour
              streamTimesRef.current.set(stream.id, startTime);
            });
            
            setLivestreams(sampleStreams);
          }
        }, 5000);

        return () => {
          clearTimeout(timer);
          if (subscriptionRef.current) {
            subscriptionRef.current.stop();
          }
        };
      } catch (error) {
        console.error('Failed to fetch livestreams:', error);
        setLoading(false);
        setError(`Failed to load livestreams: ${error instanceof Error ? error.message : String(error)}`);
        
        // Create sample streams for testing if there's an error
        const sampleStreams = createSampleLivestreams(limit);
        
        // Store start times for sample streams
        sampleStreams.forEach(stream => {
          const startsTag = stream.tags.find(tag => tag[0] === 'starts');
          const startTime = startsTag ? parseInt(startsTag[1]) * 1000 : 
                          stream.created_at ? stream.created_at * 1000 : 
                          Date.now() - Math.floor(Math.random() * 3600000);
          streamTimesRef.current.set(stream.id, startTime);
        });
        
        setLivestreams(sampleStreams);
      }
    };

    // Use debouncing to prevent too many state updates
    let debounceTimer: ReturnType<typeof setTimeout>;
    const updateLivestreamsDebounced = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateLivestreams(receivedStreamsRef.current);
      }, 1000); // Increase debounce time to avoid flashing
    };

    // Helper to update livestreams with sorting by views
    const updateLivestreams = (streams: NDKEvent[]) => {
      try {
        // Extract view counts and sort by views
        const processed = streams.map(stream => {
          // Find the viewers tag or estimate from reactions
          const viewersTag = stream.tags.find(tag => tag[0] === 'viewers' || tag[0] === 'views');
          
          // Get current view count
          let viewCount = 0;
          if (viewersTag && viewersTag[1]) {
            viewCount = parseInt(viewersTag[1], 10);
            if (isNaN(viewCount)) viewCount = 0;
          }
          
          // Count reactions as an alternative metric
          const reactions = stream.tags.filter(tag => tag[0] === 'p').length;
          
          // Total score combines explicit viewer count and reactions
          const score = viewCount > 0 ? viewCount : Math.max(10, reactions * 5);
          
          return {
            event: stream,
            views: score
          };
        });
        
        // Sort by view count (highest first)
        processed.sort((a, b) => b.views - a.views);
        
        // Take top streams up to limit
        const topStreams = processed.slice(0, limit).map(item => item.event);
        
        // Update livestreams in one go to prevent repeated rerenders
        setLivestreams(topStreams);
      } catch (err) {
        console.error('Error updating livestreams:', err);
      }
    };

    // Only fetch if we're connected to relays
    if (isConnected) {
      fetchLivestreams();
    } else {
      console.log("Not connected to relays, using sample data");
      // Create sample streams for testing if we're not connected
      const sampleStreams = createSampleLivestreams(limit);
      
      // Store start times for sample streams
      sampleStreams.forEach(stream => {
        const startsTag = stream.tags.find(tag => tag[0] === 'starts');
        const startTime = startsTag ? parseInt(startsTag[1]) * 1000 : 
                        stream.created_at ? stream.created_at * 1000 : 
                        Date.now() - Math.floor(Math.random() * 3600000);
        streamTimesRef.current.set(stream.id, startTime);
      });
      
      setLivestreams(sampleStreams);
      setLoading(false);
    }
    
    // Set up periodic refresh every minute, but don't refresh when a stream is selected
    const refreshInterval = setInterval(() => {
      if (!loading && !selectedStream && isConnected) {
        fetchLivestreams();
      }
    }, 60000);
    
    return () => {
      clearInterval(refreshInterval);
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }
    };
  }, [subscribeLivestreams, getLivestreams, limit, selectedStream, loading, isConnected]);

  // Function to create sample livestreams for testing
  const createSampleLivestreams = (count: number) => {
    const sampleStreams: NDKEvent[] = [];
    
    const streamTitles = [
      'Building a Nostr Client LIVE',
      'Exploring Bitcoin Lightning Network',
      'Code With Me: Web Development',
      'Gaming Stream: Minecraft Building',
      'Music Production Session',
      'Crypto News and Analysis',
      'Tech Talk: AI and Machine Learning',
      'Morning Coffee and Coding',
      'Let\'s Build a Smart Contract',
      'Open Source Contribution Session',
      'Art Creation: Digital Painting',
      'Podcast Recording LIVE',
      'Trading Analysis and Strategy',
      'React Development Workshop',
      'Linux System Administration',
      'Game Development in Unity',
      'NodeJS and Express Tutorial',
      'Mobile App Development',
      'Data Science Projects',
      'Rust Programming for Beginners'
    ];
    
    const streamers = [
      'jack', 'satoshi', 'ada', 'vitalik', 
      'carol', 'dave', 'evan', 'frank',
      'grace', 'henry', 'isla', 'judy',
      'kevin', 'lucy', 'mike', 'nina',
      'oscar', 'paula', 'quentin', 'rosa'
    ];
    
    // Create sample streams according to NIP-53
    for (let i = 0; i < Math.min(count, streamTitles.length); i++) {
      const mockEvent = new NDKEvent();
      mockEvent.id = `livestream-${i}`;
      mockEvent.kind = NOSTR_KIND_LIVESTREAM;
      mockEvent.pubkey = `pubkey-${streamers[i]}`;
      mockEvent.content = `Join me for a live session on ${streamTitles[i]}! We'll be discussing the latest developments and answering your questions.`;
      mockEvent.created_at = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600); // Random start time within the last hour
      
      // Randomize view count (higher for first few to simulate popularity)
      const viewCount = Math.floor(Math.random() * 1000) + 1000 / (i + 1);
      
      // Create naddr identifier for the stream (NIP-19 format)
      const nadrTag = `naddr1qqxnsp0xqyszx382xwf5092xsysz3qmnsw45wumn8ghj7mn0wvhxcmmjv95kutpvv3nvct5v94kzmt99g65m3d9hxargv6tw5sjkn9t5q4m2drp`;
      
      // NIP-53 compliant tags
      mockEvent.tags = [
        ['d', `stream-${i}`], // Identifier per NIP-53
        ['title', streamTitles[i]],
        ['summary', `Live streaming session about ${streamTitles[i].toLowerCase()}`],
        ['image', `https://picsum.photos/seed/${streamers[i]}/640/360`], // Thumbnail
        ['streaming', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'], // HLS stream URL
        ['status', 'live'], // Status must be "live" for active streams
        ['starts', mockEvent.created_at.toString()], // When stream started
        ['viewers', viewCount.toString()], // Current viewer count
        ['p', mockEvent.pubkey], // Stream host
        ['t', streamTitles[i].split(' ')[0].toLowerCase()], // Topic tag
        ['t', 'livestream'], // Generic tag
        ['naddr', nadrTag] // NIP-19 addressable identifier
      ];
      
      sampleStreams.push(mockEvent);
    }
    
    return sampleStreams;
  };

  // LivestreamCard component for displaying a livestream - memoize to prevent unnecessary rerenders
  const LivestreamCard = useCallback(({ event }: { event: NDKEvent }) => {
    // Extract metadata from tags according to NIP-53
    const titleTag = event.tags.find(tag => tag[0] === 'title');
    const title = titleTag ? titleTag[1] : 'Untitled Stream';
    
    const imageTag = event.tags.find(tag => tag[0] === 'image');
    const thumbTag = event.tags.find(tag => tag[0] === 'thumb');
    const thumbnail = imageTag ? imageTag[1] : thumbTag ? thumbTag[1] : 'https://placehold.co/320x180?text=No+Thumbnail';
    
    const viewersTag = event.tags.find(tag => tag[0] === 'viewers');
    const viewsTag = event.tags.find(tag => tag[0] === 'views');
    const viewCount = viewersTag ? parseInt(viewersTag[1]) : viewsTag ? parseInt(viewsTag[1]) : Math.floor(Math.random() * 100) + 10;
    
    // Use the cached start time to avoid flashing/jumping
    const startTime = streamTimesRef.current.get(event.id) || 
                      (event.created_at ? event.created_at * 1000 : Date.now());
    
    // Calculate stream duration (replaced useMemo with regular function)
    const calculateStreamDuration = (startTimeMs: number) => {
      return Math.floor((Date.now() - startTimeMs) / (1000 * 60)); // in minutes
    };
    
    // Get the stream duration
    const streamDuration = calculateStreamDuration(startTime);
    
    // Format viewer count
    const formatViewCount = (count: number) => {
      if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M viewers`;
      } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K viewers`;
      }
      return `${count} viewers`;
    };
    
    // Format duration in a human-readable way
    const formatDuration = (minutes: number) => {
      if (minutes < 60) {
        return `${minutes}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
      }
    };
    
    // Handle click to view the livestream
    const handleStreamSelect = (e: React.MouseEvent) => {
      e.preventDefault();
      setSelectedStream(event);
    };

    // Get naddr identifier if available
    const nadrTag = event.tags.find(tag => tag[0] === 'naddr');
    const hasValidNaddr = Boolean(nadrTag && nadrTag[1]);

    return (
      <div className="video-card livestream" onClick={handleStreamSelect}>
        <div className="video-thumbnail">
          <img 
            src={thumbnail} 
            alt={title} 
            loading="lazy" 
            decoding="async"
            fetchPriority="high"
          />
          <span className="live-indicator">LIVE</span>
          <span className="viewer-count">{formatViewCount(viewCount)}</span>
          {hasValidNaddr && <span className="naddr-indicator">naddr</span>}
        </div>
        <div className="video-info">
          <h3 className="video-title">{title}</h3>
          <p className="video-description">{event.content.slice(0, 100)}...</p>
          <div className="video-meta">
            <span className="video-author">{event.pubkey.slice(0, 10)}...</span>
            <span className="video-date">
              Live for {formatDuration(streamDuration)}
            </span>
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <div className="livestream-feed">
      {loading ? (
        <div className="loading">Loading livestreams...</div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <div className="suggest-relays">
            <p>Try connecting to these Nostr streaming relays:</p>
            <ul>
              <li>wss://relay.zaps.stream</li>
              <li>wss://relay.damus.io</li>
              <li>wss://nos.lol</li>
            </ul>
          </div>
        </div>
      ) : memoizedLivestreams.length === 0 ? (
        <div className="no-streams">
          <p>No active livestreams found</p>
          <div className="suggest-relays">
            <p>Try connecting to these Nostr streaming relays:</p>
            <ul>
              <li>wss://relay.zaps.stream</li>
              <li>wss://relay.damus.io</li>
              <li>wss://nos.lol</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="stream-grid">
          {memoizedLivestreams.map(stream => (
            <LivestreamCard key={stream.id} event={stream} />
          ))}
        </div>
      )}
      
      {selectedStream && (
        <LivestreamPlayer 
          event={selectedStream} 
          onClose={() => setSelectedStream(null)} 
          isSearching={isSearching}
        />
      )}
    </div>
  );
};

// Livestream player component with full NIP-53 support
const LivestreamPlayer = ({ event, onClose, isSearching = false }: { event: NDKEvent, onClose: () => void, isSearching?: boolean }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentViewers, setCurrentViewers] = useState<number>(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Extract stream metadata according to NIP-53
  const titleTag = event.tags.find(tag => tag[0] === 'title');
  const title = titleTag ? titleTag[1] : 'Untitled Stream';
  
  const summaryTag = event.tags.find(tag => tag[0] === 'summary');
  const summary = summaryTag ? summaryTag[1] : event.content;
  
  // Get naddr identifier if available
  const nadrTag = event.tags.find(tag => tag[0] === 'naddr');
  const nadrIdentifier = nadrTag ? nadrTag[1] : null;
  
  // Get streaming URL according to NIP-53
  useEffect(() => {
    // Primary streaming URL from NIP-53
    const streamingTag = event.tags.find(tag => tag[0] === 'streaming');
    if (streamingTag && streamingTag[1]) {
      setStreamUrl(streamingTag[1]);
      return;
    }
    
    // Alternative URLs that might work
    const urlTag = event.tags.find(tag => tag[0] === 'url');
    if (urlTag && urlTag[1]) {
      setStreamUrl(urlTag[1]);
      return;
    }
    
    const mediaTag = event.tags.find(tag => tag[0] === 'media');
    if (mediaTag && mediaTag[1]) {
      setStreamUrl(mediaTag[1]);
      return;
    }
    
    // Check for URLs in content
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const contentUrls = event.content.match(urlRegex);
    if (contentUrls && contentUrls.length > 0) {
      setStreamUrl(contentUrls[0]);
      return;
    }
    
    // Fallback to a sample stream for testing
    setStreamUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  }, [event]);
  
  // Get viewer count from NIP-53 tags
  const viewersTag = event.tags.find(tag => tag[0] === 'viewers');
  const viewsTag = event.tags.find(tag => tag[0] === 'views');
  const initialViewCount = viewersTag ? parseInt(viewersTag[1]) : 
                          viewsTag ? parseInt(viewsTag[1]) : 
                          Math.floor(Math.random() * 1000) + 10;
  
  // Additional metadata per NIP-53
  const startsTag = event.tags.find(tag => tag[0] === 'starts');
  const startTime = startsTag ? parseInt(startsTag[1]) : event.created_at;
  
  const categoryTags = event.tags.filter(tag => tag[0] === 't').map(tag => tag[1]);
  
  // Get streamer information
  const streamerPubkey = event.pubkey;
  const streamerTag = event.tags.find(tag => tag[0] === 'p');
  const streamerName = streamerTag?.[1] || streamerPubkey.slice(0, 10) + '...';
  
  // Handle video load events
  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    
    const videoElement = videoRef.current;
    
    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    
    const handleError = () => {
      setIsLoading(false);
      setError('Could not load video stream. The stream may be offline or in an unsupported format.');
    };
    
    // Set initial viewer count only once
    setCurrentViewers(initialViewCount);
    
    // Attach event listeners
    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    
    let viewerUpdateInterval: NodeJS.Timeout | null = null;
    
    // Only simulate periodic viewer count updates if not in search mode
    if (!isSearching) {
      viewerUpdateInterval = setInterval(() => {
        // In a real implementation, you would fetch this from the relay
        // For now, we'll just add some random variation
        const randomVariation = Math.floor(Math.random() * 10) - 5; // -5 to +5
        setCurrentViewers(prev => Math.max(10, prev + randomVariation));
      }, 5000);
    }
    
    return () => {
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('error', handleError);
      if (viewerUpdateInterval) {
        clearInterval(viewerUpdateInterval);
      }
    };
  }, [initialViewCount, isSearching, streamUrl]);
  
  // Handle zaps (NIP-57) functionality
  const handleZap = () => {
    // In a real implementation, you would use the NDK zap functionality
    console.log('Zapping stream:', event.id);
    alert('Zap feature would be implemented here using NIP-57');
  };
  
  // Handle sharing
  const handleShare = () => {
    // Create a shareable link using naddr if available
    const shareLink = nadrIdentifier 
      ? `https://snails.tube/stream/${nadrIdentifier}` 
      : `https://snails.tube/stream/${event.id}`;
      
    navigator.clipboard.writeText(shareLink)
      .then(() => alert('Stream link copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err));
  };
  
  // Handle closing the player
  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  // Preload poster image
  useEffect(() => {
    const posterUrl = event.tags.find(tag => tag[0] === 'image')?.[1];
    if (posterUrl) {
      const img = new Image();
      img.src = posterUrl;
    }
  }, [event]);

  // Format the start time nicely
  const formattedStartTime = useMemo(() => {
    if (!startTime) return 'Unknown';
    
    // Format time consistently
    const date = new Date(startTime * 1000);
    return date.toLocaleTimeString();
  }, [startTime]);

  return (
    <div className="video-player-overlay" onClick={handleClose}>
      <div className="video-player-container livestream-player" onClick={e => e.stopPropagation()}>
        <div className="video-player-header">
          <div className="stream-info">
            <h2>{title}</h2>
            <span className="live-badge">LIVE</span>
            <span className="viewer-count">{currentViewers} watching</span>
            {nadrIdentifier && <span className="naddr-badge">naddr</span>}
          </div>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="video-player-content">
          {isLoading && (
            <div className="video-loading">
              <p>Loading stream...</p>
            </div>
          )}
          
          {error && (
            <div className="video-error">
              <p>{error}</p>
            </div>
          )}
          
          {streamUrl && (
            <video 
              ref={videoRef}
              controls 
              autoPlay 
              className="video-player"
              poster={event.tags.find(tag => tag[0] === 'image')?.[1]}
              playsInline
            >
              <source src={streamUrl} type="application/x-mpegURL" />
              Your browser does not support the video tag or HLS streams.
            </video>
          )}
        </div>
        
        <div className="video-player-description">
          <div className="stream-header">
            <h3>{title}</h3>
            <p className="stream-time">
              Started {formattedStartTime}
            </p>
          </div>
          
          <p className="stream-summary">{summary}</p>
          
          {categoryTags.length > 0 && (
            <div className="stream-tags">
              {categoryTags.map((tag, index) => (
                <span key={index} className="stream-tag">#{tag}</span>
              ))}
            </div>
          )}
          
          <div className="video-meta">
            <div className="streamer-info">
              <span className="video-author">Streamer: {streamerName}</span>
            </div>
            
            <div className="stream-actions">
              <button className="action-button zap-button" onClick={handleZap}>
                ⚡️ Zap
              </button>
              <button className="action-button share-button" onClick={handleShare}>
                Share
              </button>
              <button className="action-button follow-button">
                Follow
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function SnailsTubePage() {
  const { isConnected, isLoading, connectToStreamingRelays } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('livestream');

  // Create a filter with a timestamp to avoid fetching the entire history
  // Current time minus 30 days in seconds
  const defaultFilter = useMemo(() => ({
    kinds: [NOSTR_KIND_HIGHLIGHT, NOSTR_KIND_REGULAR_NOTE, NOSTR_KIND_ARTICLE],
    since: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
  }), []);
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Force refresh the feed
    setRefreshKey(prev => prev + 1);
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const renderLivestreamContent = useCallback(() => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Top Live Streams</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <LivestreamFeed key={`live-${refreshKey}`} limit={20} />
      </div>
    );
  }, [isLoading, isConnected, isRefreshing, refreshKey]);

  // Connect to livestreaming relays when the page loads
  useEffect(() => {
    const initStreamingRelays = async () => {
      if (isConnected) {
        try {
          await connectToStreamingRelays();
          console.log('Connected to livestreaming relays');
        } catch (error) {
          console.error('Failed to connect to streaming relays:', error);
        }
      }
    };
    
    initStreamingRelays();
  }, [isConnected, connectToStreamingRelays]);

  const renderVideoContent = useCallback(() => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Nostr Videos</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <VideoFeed key={refreshKey} filter={defaultFilter} limit={15} />
      </div>
    );
  }, [isLoading, isConnected, isRefreshing, refreshKey, defaultFilter]);

  const renderTrendingContent = () => (
    <div>
      {renderVideoContent()}
    </div>
  );

  const renderSubscriptionsContent = () => (
    <div className="subscriptions-container">
      <h2>Your Subscriptions</h2>
      {isConnected ? (
        <div className="coming-soon">
          <p>Coming soon!</p>
        </div>
      ) : (
        <p>Connect to see your subscriptions</p>
      )}
    </div>
  );

  const renderLibraryContent = () => (
    <div className="library-container">
      <h2>Your Library</h2>
      {isConnected ? (
        <div className="coming-soon">
          <p>Coming soon!</p>
        </div>
      ) : (
        <p>Connect to see your library</p>
      )}
    </div>
  );

  return (
    <div className="snailstube-container">
      <div className="snailsfeed-sidebar left">
        <div className="snailsfeed-section">
          <ProfileCard />
        </div>
        
        <div className="snailsfeed-section">
          <TrendingHashtags />
        </div>
      </div>
      
      <main className="snailsfeed-main">
        <div className="snailsfeed-section main-card">
          <div className="feed-tabs">
            <button 
              className={`tab-button livestream-tab ${activeTab === 'livestream' ? 'active' : ''}`}
              onClick={() => setActiveTab('livestream')}
            >
              Livestream
            </button>
          <button 
            className={`tab-button ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            Trending
          </button>
          <button 
            className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </button>
          <button 
            className={`tab-button ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            Library
          </button>
          </div>
        </div>
        
        <div className="feed-wrapper">
          {activeTab === 'livestream' && renderLivestreamContent()}
          {activeTab === 'trending' && renderTrendingContent()}
          {activeTab === 'subscriptions' && renderSubscriptionsContent()}
          {activeTab === 'library' && renderLibraryContent()}
        </div>
      </main>
    </div>
  );
} 