import { useEffect, useState } from 'react';
import { NDKEvent, NDKUser } from '@nostr-dev-kit/ndk';
import nostrService from '../services/nostr';
import { Profile, DirectMessage } from '../db';

export function useNostr(explicitRelayUrls?: string[]) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<NDKUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initNostr = async () => {
      setIsLoading(true);
      try {
        await nostrService.init();
        
        // Add custom relays if provided
        if (explicitRelayUrls && explicitRelayUrls.length > 0) {
          await nostrService.addRelays(explicitRelayUrls);
        }
        
        setIsConnected(true);
        const user = nostrService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to initialize Nostr:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initNostr();
  }, [explicitRelayUrls]);

  // Login with NIP-07 extension
  const loginWithExtension = async () => {
    setIsLoading(true);
    try {
      const user = await nostrService.loginWithExtension();
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Failed to login with extension:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profile data
  const fetchProfile = async (pubkey: string): Promise<Profile | null> => {
    const profile = await nostrService.fetchAndCacheProfile(pubkey);
    
    // Update currentUser profile if we fetched the current user's profile
    if (profile && currentUser && pubkey === currentUser.pubkey) {
      // Create a new NDKUser to trigger React re-render
      const updatedUser = new NDKUser({ pubkey: currentUser.pubkey });
      
      // Initialize profile object
      updatedUser.profile = {
        name: profile.name || '',
        displayName: profile.displayName || '',
        image: profile.picture || '',
        about: profile.about || '',
        nip05: profile.nip05 || '',
        banner: profile.banner || ''
      };
      
      setCurrentUser(updatedUser);
    }
    
    return profile;
  };

  // Fetch a specific event by ID
  const fetchEvent = async (eventId: string): Promise<NDKEvent | null> => {
    try {
      return await nostrService.getEvent(eventId);
    } catch (error) {
      console.error('Failed to fetch event:', error);
      return null;
    }
  };

  // Update profile metadata
  const updateProfile = async (profileData: {
    displayName?: string;
    name?: string;
    about?: string;
    website?: string;
    nip05?: string;
    picture?: string;
    banner?: string;
  }): Promise<boolean> => {
    try {
      const event = await nostrService.publishProfileMetadata(profileData);
      return !!event;
    } catch (error) {
      console.error('Failed to update profile:', error);
      return false;
    }
  };

  // Subscribe to notes
  const subscribeToNotes = async (
    pubkeys?: string[],
    limit = 100,
    onEvent?: (event: NDKEvent) => void
  ) => {
    try {
      // Create a filter object with sensible defaults
      const filter: {
        kinds: number[];
        limit: number;
        authors?: string[];
        since?: number;
      } = { 
        kinds: [1], 
        limit 
      };
      
      // Add authors filter only if we have valid authors
      if (pubkeys && pubkeys.length > 0) {
        filter.authors = pubkeys;
        
        // For profile feeds, add a longer time range (90 days) to show more content
        // This prevents profile pages from being empty
        const ninetyDaysAgo = Math.floor(Date.now() / 1000) - (90 * 86400);
        filter.since = ninetyDaysAgo;
      } else {
        // If no authors specified, add a time constraint to avoid fetching the entire history
        // Use 90 days instead of 30 days to get more content
        filter.since = Math.floor(Date.now() / 1000) - (90 * 86400);
        console.log('No authors specified, using extended time constraint for feed.');
      }
      
      // For blogs (kind 30023), increase the limit to get more content
      // and ensure we get a mix of verified and unverified authors
      if (filter.kinds.includes(30023)) {
        // Double the limit for blog posts to ensure we get more variety
        filter.limit = Math.min(500, filter.limit * 2);
        
        // Ensure we have at least 90 days of history for blogs
        const ninetyDaysAgo = Math.floor(Date.now() / 1000) - (90 * 86400);
        filter.since = Math.min(filter.since || ninetyDaysAgo, ninetyDaysAgo);
        
        console.log('Blog feed detected, using extended parameters:', filter);
      }
      
      console.log('useNostr: Subscribing with filter:', filter);
      
      // Track a set of seen pubkeys to detect potential bot farms
      const seenPubkeys = new Set<string>();
      const pubkeyEventCount: Record<string, number> = {};
      
      // Subscribe with our filter
      const subscription = await nostrService.subscribeToNotes(filter);
      
      // Add event handler if provided
      if (subscription && onEvent) {
        // Enhanced event handler to detect and filter potential bots
        subscription.on('event', (event) => {
          // Track event counts per pubkey
          const pubkey = event.pubkey;
          pubkeyEventCount[pubkey] = (pubkeyEventCount[pubkey] || 0) + 1;
          seenPubkeys.add(pubkey);
          
          // Check for potential bot farm (many events from same pubkey)
          const isSuspicious = pubkeyEventCount[pubkey] > 10;
          
          // Apply additional bot detection for suspected bots
          if (isSuspicious) {
            // Check for common bot patterns
            const lowerContent = event.content.toLowerCase();
            const botSignatures = [
              'automatically generated',
              'auto-posted',
              'bot generated',
              'powered by ai',
              'ai generated',
              'auto-publish'
            ];
            
            const hasBotSignature = botSignatures.some(sig => lowerContent.includes(sig));
            
            // Simple check for repetitive content structure
            const paragraphs = event.content.split('\n\n');
            const isPotentiallyRepetitive = paragraphs.length > 3 && 
                paragraphs.every(p => p.length > 0 && p.length < 300) &&
                Math.abs(paragraphs[0].length - paragraphs[1].length) < 30;
                
            // Skip likely bot content
            if (hasBotSignature || isPotentiallyRepetitive) {
              console.log(`Filtering suspected bot content from ${pubkey}`);
              return;
            }
          }
          
          // Pass the event to the original handler
          onEvent(event);
        });
      }
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to notes:', error);
      return null;
    }
  };

  // Fetch videos for a user
  const fetchVideos = async (pubkey: string, limit = 5) => {
    try {
      const filter = {
        kinds: [1, 30023], // Include regular notes and long-form content that might have videos
        authors: [pubkey],
        limit: limit * 2, // Fetch more to filter for video content
        since: Math.floor(Date.now() / 1000) - (90 * 86400) // 90 days back
      };

      const events = await nostrService.getEvents(filter);
      
      // Filter events that likely contain video content
      const videoEvents = events.filter((event: NDKEvent) => {
        // Check for video links in content
        const hasVideoLink = 
          event.content.includes('youtube.com') || 
          event.content.includes('youtu.be') || 
          event.content.includes('vimeo.com') ||
          event.content.includes('mp4') ||
          event.content.includes('video');
          
        // Check for video tags
        const hasVideoTag = event.tags.some((tag: string[]) => 
          (tag[0] === 'r' && (
            tag[1].includes('youtube.com') || 
            tag[1].includes('youtu.be') ||
            tag[1].includes('vimeo.com') ||
            tag[1].endsWith('.mp4')
          )) ||
          (tag[0] === 't' && tag[1] === 'video')
        );
        
        return hasVideoLink || hasVideoTag;
      });
      
      // Process events to extract relevant video information
      return videoEvents.slice(0, limit).map((event: NDKEvent) => {
        // Extract video thumbnail if available
        const thumbnailTag = event.tags.find((tag: string[]) => tag[0] === 'image' || tag[0] === 'thumbnail');
        const thumbnail = thumbnailTag ? thumbnailTag[1] : null;
        
        // Extract author name
        const authorProfile = event.author?.profile;
        const authorName = authorProfile?.displayName || authorProfile?.name || 'Anonymous';
        
        return {
          id: event.id,
          content: event.content,
          created_at: event.created_at,
          pubkey: event.pubkey,
          authorName,
          thumbnail
        };
      });
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      return [];
    }
  };

  // Publish a note
  const publishNote = async (content: string, replyTo?: string) => {
    return nostrService.publishNote(content, replyTo);
  };

  // Helper for NIP-19 encoding
  const encodePublicKey = (pubkey: string): string => {
    return nostrService.encodePublicKey(pubkey);
  };

  // Helper for NIP-19 decoding
  const decodePublicKey = (npub: string): string | null => {
    return nostrService.decodePublicKey(npub);
  };

  // NIP-05 verification
  const verifyNip05 = async (pubkey: string, nip05Identifier: string): Promise<boolean> => {
    return nostrService.verifyNip05(pubkey, nip05Identifier);
  };

  // NIP-02: Contact Lists
  const fetchContactList = async (): Promise<string[]> => {
    return nostrService.fetchContactList();
  };

  const followUser = async (pubkey: string): Promise<boolean> => {
    return nostrService.followUser(pubkey);
  };

  const unfollowUser = async (pubkey: string): Promise<boolean> => {
    try {
      return await nostrService.unfollowUser(pubkey);
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      return false;
    }
  };

  // Get following list for a specific pubkey
  const getFollowing = async (pubkey: string): Promise<string[]> => {
    try {
      return await nostrService.getFollowing(pubkey);
    } catch (error) {
      console.error('Failed to get following list:', error);
      return [];
    }
  };

  // NIP-04: Direct Messages
  const sendDirectMessage = async (recipientPubkey: string, content: string): Promise<boolean> => {
    return nostrService.sendDirectMessage(recipientPubkey, content);
  };

  const getDirectMessages = async (otherPubkey?: string): Promise<DirectMessage[]> => {
    return nostrService.getDirectMessages(otherPubkey);
  };

  // NIP-25: Reactions
  const createReaction = async (eventId: string, reaction: string = '+'): Promise<boolean> => {
    return nostrService.createReaction(eventId, reaction);
  };

  // NIP-23: Long-form content
  const publishLongformContent = async (
    title: string, 
    content: string,
    summary: string = '',
    image?: string,
    tags: string[] = []
  ): Promise<NDKEvent | null> => {
    return nostrService.publishLongformContent(title, content, summary, image, tags);
  };

  // NIP-51: Lists
  const createList = async (
    name: string,
    description: string,
    items: Array<{id: string, relatedPubkey?: string, url?: string}>,
    listKind: 'bookmarks' | 'articles' | 'channels' | 'custom' = 'custom',
    customKind?: number
  ): Promise<NDKEvent | null> => {
    return nostrService.createList(name, description, items, listKind, customKind);
  };

  // NIP-57: Zaps
  const createZapRequest = async (
    eventId: string | null,
    recipientPubkey: string,
    amount: number,
    content: string = ''
  ): Promise<string | null> => {
    return nostrService.createZapRequest(eventId, recipientPubkey, amount, content);
  };

  // NIP-71: Video events
  const publishVideoEvent = async (
    title: string,
    videoUrl: string,
    thumbnailUrl: string,
    description: string = '',
    duration?: number,
    dimensions?: {width: number, height: number},
    tags: string[] = []
  ): Promise<NDKEvent | null> => {
    return nostrService.publishVideoEvent(
      title, 
      videoUrl, 
      thumbnailUrl, 
      description, 
      duration, 
      dimensions, 
      tags
    );
  };

  // NIP-94: File metadata
  const createFileMetadata = async (
    url: string,
    name: string,
    size: number,
    mimeType: string,
    hash?: string,
    magnetURI?: string,
    torrentInfoHash?: string,
    description: string = '',
    dimensions?: {width: number, height: number},
    blurhash?: string
  ): Promise<NDKEvent | null> => {
    return nostrService.createFileMetadata(
      url,
      name,
      size,
      mimeType,
      hash,
      magnetURI,
      torrentInfoHash,
      description,
      dimensions,
      blurhash
    );
  };

  // NIP-98: HTTP Auth
  const createAuthEvent = async (url: string, method: string = 'GET'): Promise<string | null> => {
    return nostrService.createAuthEvent(url, method);
  };

  // Save user's preferred relays
  const saveRelays = async (relays: string[]): Promise<boolean> => {
    try {
      return await nostrService.addRelays(relays);
    } catch (error) {
      console.error('Failed to save relays:', error);
      return false;
    }
  };

  // Search across Nostr
  const searchNostr = async (query: string, limit: number = 20) => {
    return nostrService.searchNostr(query, limit);
  };

  // Livestreaming functionality
  const getRecommendedStreamingRelays = () => {
    return nostrService.getRecommendedStreamingRelays();
  };

  const connectToStreamingRelays = async () => {
    return nostrService.connectToStreamingRelays();
  };

  const subscribeLivestreams = async (callback: (event: NDKEvent) => void) => {
    try {
      const subscription = await nostrService.subscribeLivestreams();
      if (subscription) {
        subscription.on('event', callback);
      }
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to livestreams:', error);
      return null;
    }
  };

  const getLivestreams = async () => {
    return nostrService.getLivestreams();
  };

  const isLivestreamActive = async (eventId: string) => {
    return nostrService.isLivestreamActive(eventId);
  };

  const getLivestreamDetails = async (eventId: string) => {
    return nostrService.getLivestreamDetails(eventId);
  };

  // Update to match StartLivestreamPage component parameter format
  const startLivestream = async (params: {
    title: string;
    streaming: string;
    summary?: string;
    image?: string;
    tags?: string[];
  }) => {
    return nostrService.startLivestream(
      params.title,
      params.streaming,
      params.summary || '',
      params.image || '',
      params.tags || []
    );
  };

  const endLivestream = async (eventId: string) => {
    return nostrService.endLivestream(eventId);
  };

  return {
    isConnected,
    isLoading,
    currentUser,
    ndk: nostrService.getNdk(),
    loginWithExtension,
    fetchProfile,
    fetchEvent,
    updateProfile,
    subscribeToNotes,
    fetchVideos,
    publishNote,
    encodePublicKey,
    decodePublicKey,
    verifyNip05,
    fetchContactList,
    followUser,
    unfollowUser,
    getFollowing,
    sendDirectMessage,
    getDirectMessages,
    createReaction,
    publishLongformContent,
    createList,
    createZapRequest,
    publishVideoEvent,
    createFileMetadata,
    createAuthEvent,
    saveRelays,
    searchNostr,
    getRecommendedStreamingRelays,
    connectToStreamingRelays,
    subscribeLivestreams,
    getLivestreams,
    isLivestreamActive,
    getLivestreamDetails,
    startLivestream,
    endLivestream
  };
} 