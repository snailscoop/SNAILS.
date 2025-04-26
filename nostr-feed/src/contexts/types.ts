import NDK, { NDKEvent, NDKUser, NDKSubscription } from '@nostr-dev-kit/ndk';
import { DirectMessage, Profile } from '../db';

export interface NostrContextType {
  isConnected: boolean;
  isLoading: boolean;
  currentUser: NDKUser | null;
  ndk: NDK;
  loginWithExtension: () => Promise<NDKUser | null>;
  fetchProfile: (pubkey: string) => Promise<Profile | null>;
  fetchEvent: (eventId: string) => Promise<NDKEvent | null>;
  updateProfile: (profileData: {
    displayName?: string;
    name?: string;
    about?: string;
    website?: string;
    nip05?: string;
    picture?: string;
    banner?: string;
  }) => Promise<boolean>;
  saveRelays: (relays: string[]) => Promise<boolean>;
  subscribeToNotes: (pubkeys?: string[], limit?: number, onEvent?: (event: NDKEvent) => void) => Promise<NDKSubscription | null>;
  publishNote: (content: string, replyTo?: string) => Promise<NDKEvent | null>;
  encodePublicKey: (pubkey: string) => string;
  decodePublicKey: (npub: string) => string | null;
  verifyNip05: (pubkey: string, nip05Identifier: string) => Promise<boolean>;
  
  // NIP-02: Contact Lists
  fetchContactList: () => Promise<string[]>;
  followUser: (pubkey: string) => Promise<boolean>;
  unfollowUser: (pubkey: string) => Promise<boolean>;
  getFollowing: (pubkey: string) => Promise<string[]>;
  
  // NIP-04: Direct Messages
  sendDirectMessage: (recipientPubkey: string, content: string) => Promise<boolean>;
  getDirectMessages: (otherPubkey?: string) => Promise<DirectMessage[]>;
  
  // NIP-25: Reactions
  createReaction: (eventId: string, reaction?: string) => Promise<boolean>;
  
  // NIP-23: Long-form content
  publishLongformContent: (
    title: string, 
    content: string,
    summary?: string,
    image?: string,
    tags?: string[]
  ) => Promise<NDKEvent | null>;
  
  // Video functionality
  fetchVideos: (pubkey: string, limit?: number) => Promise<any[]>;
  
  // NIP-51: Lists
  createList: (
    name: string,
    description: string,
    items: Array<{id: string, relatedPubkey?: string, url?: string}>,
    listKind?: 'bookmarks' | 'articles' | 'channels' | 'custom',
    customKind?: number
  ) => Promise<NDKEvent | null>;
  
  // NIP-57: Zaps
  createZapRequest: (
    eventId: string | null,
    recipientPubkey: string,
    amount: number,
    content?: string
  ) => Promise<string | null>;
  
  // NIP-71: Video events
  publishVideoEvent: (
    title: string,
    videoUrl: string,
    thumbnailUrl: string,
    description?: string,
    duration?: number,
    dimensions?: {width: number, height: number},
    tags?: string[]
  ) => Promise<NDKEvent | null>;
  
  // NIP-94: File metadata
  createFileMetadata: (
    url: string,
    name: string,
    size: number,
    mimeType: string,
    hash?: string,
    magnetURI?: string,
    torrentInfoHash?: string,
    description?: string,
    dimensions?: {width: number, height: number},
    blurhash?: string
  ) => Promise<NDKEvent | null>;
  
  // NIP-98: HTTP Auth
  createAuthEvent: (url: string, method?: string) => Promise<string | null>;
  
  // Search functionality
  searchNostr: (query: string, limit?: number) => Promise<{
    users: Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>,
    hashtags: Array<{tag: string; count: number}>,
    posts: NDKEvent[]
  }>;
  
  // Livestreaming functionality
  getRecommendedStreamingRelays: () => string[];
  connectToStreamingRelays: () => Promise<boolean>;
  subscribeLivestreams: (callback: (event: NDKEvent) => void) => Promise<NDKSubscription | null>;
  getLivestreams: () => Promise<NDKEvent[]>;
  isLivestreamActive: (eventId: string) => Promise<boolean>;
  getLivestreamDetails: (eventId: string) => Promise<{
    title: string;
    status: string;
    viewers: number;
    startTime: number;
    streamUrl: string;
    author: string;
  } | null>;
  startLivestream: (params: {
    title: string;
    streaming: string;
    summary?: string;
    image?: string;
    tags?: string[];
  }) => Promise<NDKEvent | null>;
  endLivestream: (eventId: string) => Promise<boolean>;
}

export interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: { id: ThemeType; name: string }[];
}

export type ThemeType = 'light' | 'dark' | 'snail'; 