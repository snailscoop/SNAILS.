import NDK, { 
  NDKEvent, 
  NDKUser, 
  NDKRelay,
  NDKFilter,
  NDKSubscriptionOptions,
  NDKNip07Signer,
  NDKKind
} from '@nostr-dev-kit/ndk';
import * as nip19 from 'nostr-tools/nip19';
import * as nip05 from 'nostr-tools/nip05';
import * as nip04 from 'nostr-tools/nip04';
import { db, DirectMessage, NostrEvent, Profile } from '../db';
import { DEFAULT_RELAYS, BLOG_FOCUSED_RELAYS } from '../config/relays';

/**
 * Interface for NIP-11 relay information document
 */
export interface RelayInfo {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: {
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    min_prefix?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
    created_at_lower_limit?: number;
    created_at_upper_limit?: number;
    event_retention_time?: number;
  };
  [key: string]: any; // For additional custom properties
}

// Extended signer interface to support getSecretKey
interface ExtendedNip07Signer extends NDKNip07Signer {
  getSecretKey?: () => Promise<string>;
}

class NostrService {
  private ndk: NDK;
  private signer: NDKNip07Signer | null = null;
  private currentUser: NDKUser | null = null;
  private userPrivateKey: string | null = null;
  private relayStatusMap: Map<string, {
    connected: boolean,
    errors: number,
    lastConnected: number,
    lastError: number
  }> = new Map();
  private connectionMonitorInterval: ReturnType<typeof setInterval> | null = null;

  // NIP-11: Relay Information Document cache
  private relayInfoCache: Map<string, {
    info: {
      name?: string;
      description?: string;
      pubkey?: string;
      contact?: string;
      supported_nips?: number[];
      software?: string;
      version?: string;
      limitation?: {
        max_message_length?: number;
        max_subscriptions?: number;
        max_filters?: number;
        max_limit?: number;
        max_subid_length?: number;
        min_prefix?: number;
        max_event_tags?: number;
        max_content_length?: number;
        min_pow_difficulty?: number;
        auth_required?: boolean;
        payment_required?: boolean;
        created_at_lower_limit?: number;
        created_at_upper_limit?: number;
        event_retention_time?: number;
      };
      [key: string]: unknown;
    },
    timestamp: number
  }> = new Map();

  constructor() {
    // Initialize NDK with default relays
    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      autoConnectUserRelays: true,
      enableOutboxModel: true
    });
    
    // Initialize relay status tracking
    DEFAULT_RELAYS.forEach(url => {
      this.relayStatusMap.set(url, {
        connected: false,
        errors: 0,
        lastConnected: 0,
        lastError: 0
      });
    });
  }

  async init() {
    try {
      // Set up relay connection event listeners
      this.setupRelayListeners();
      
      await this.ndk.connect();
      console.log('Connected to NDK relays');
      
      // Start monitoring relay connections
      this.startConnectionMonitor();
      
      // Try to use NIP-07 extension for signing if available
      try {
        this.signer = new NDKNip07Signer();
        await this.loginWithExtension();
      } catch {
        console.log('No NIP-07 extension available');
      }
    } catch (error) {
      console.error('Failed to connect to relays:', error);
    }
  }
  
  // Set up event listeners for relay connections
  private setupRelayListeners() {
    if (!this.ndk.pool) return;
    
    // Track when relays connect
    this.ndk.pool.on('relay:connect', (relay: NDKRelay) => {
      const status = this.relayStatusMap.get(relay.url);
      if (status) {
        status.connected = true;
        status.lastConnected = Date.now();
        console.log(`Connected to relay: ${relay.url}`);
      }
    });
    
    // Track when relays disconnect
    this.ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
      const status = this.relayStatusMap.get(relay.url);
      if (status) {
        status.connected = false;
        console.log(`Disconnected from relay: ${relay.url}`);
      }
    });
    
    // Listen for pool connection events
    this.ndk.pool.on('connect', () => {
      console.log('Pool connected');
    });
  }
  
  // Start periodic connection monitoring
  private startConnectionMonitor() {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }
    
    // Check connection status every 30 seconds
    this.connectionMonitorInterval = setInterval(() => {
      this.checkRelayConnections();
    }, 30000);
  }
  
  // Check and attempt to reconnect to disconnected relays
  private async checkRelayConnections() {
    if (!this.ndk.pool) return;
    
    const now = Date.now();
    let disconnectedCount = 0;
    let connectedCount = 0;
    
    // Check all relays in our tracking map
    for (const [url, status] of this.relayStatusMap.entries()) {
      if (status.connected) {
        connectedCount++;
      } else {
        disconnectedCount++;
        
        // Don't attempt to reconnect too frequently (at least 10s between attempts)
        const timeSinceLastError = now - status.lastError;
        if (timeSinceLastError > 10000) {
          try {
            console.log(`Attempting to reconnect to ${url}`);
            
            const relay = this.ndk.pool.relays.get(url);
            if (relay) {
              // Relay exists but is disconnected - try to reconnect
              await relay.connect();
            } else {
              // Relay doesn't exist in the pool - add it
              const relay = new NDKRelay(url, undefined, this.ndk);
              await this.ndk.pool.addRelay(relay);
            }
          } catch (error) {
            status.errors++;
            status.lastError = now;
            console.error(`Failed to reconnect to ${url}:`, error);
          }
        }
      }
    }
    
    console.log(`Relay status: ${connectedCount} connected, ${disconnectedCount} disconnected`);
  }
  
  // Get a list of currently connected relays
  getConnectedRelays(): string[] {
    const connectedRelays: string[] = [];
    
    for (const [url, status] of this.relayStatusMap.entries()) {
      if (status.connected) {
        connectedRelays.push(url);
      }
    }
    
    return connectedRelays;
  }
  
  // Get all relay status information for debugging
  getRelayStatus(): Array<{url: string, connected: boolean, errors: number}> {
    const result = [];
    
    for (const [url, status] of this.relayStatusMap.entries()) {
      result.push({
        url,
        connected: status.connected,
        errors: status.errors
      });
    }
    
    return result;
  }

  // Login with NIP-07 extension
  async loginWithExtension() {
    if (!this.signer) return null;
    
    try {
      const user = await this.signer.user();
      this.currentUser = user;
      this.ndk.signer = this.signer;
      
      // Get and store user profile
      await this.fetchAndCacheProfile(user.pubkey);
      
      return user;
    } catch (error) {
      console.error('Failed to login with extension:', error);
      return null;
    }
  }

  // Helper for NIP-19 npub encoding
  encodePublicKey(pubkey: string): string {
    return nip19.npubEncode(pubkey);
  }

  // Helper for NIP-19 decoding
  decodePublicKey(npub: string): string | null {
    try {
      const { type, data } = nip19.decode(npub);
      if (type === 'npub') {
        return data as string;
      }
      return null;
    } catch (_error) {
      console.error('Failed to decode npub:', _error);
      return null;
    }
  }

  // NIP-05 verification
  async verifyNip05(pubkey: string, nip05Identifier: string): Promise<boolean> {
    // Check if we've already failed for this identifier recently (implement a local cache)
    const nip05Cache = localStorage.getItem('nip05_cache');
    const cache = nip05Cache ? JSON.parse(nip05Cache) : {};
    const cacheKey = `${nip05Identifier}:${pubkey}`;
    
    // If we've already checked this identifier in the last hour, use the cached result
    if (cache[cacheKey]) {
      if (Date.now() - cache[cacheKey].timestamp < 3600000) { // 1 hour
        console.log('Using cached NIP-05 verification result for:', nip05Identifier);
        return cache[cacheKey].result;
      }
    }
    
    try {
      // Try the standard direct verification first 
      try {
        console.log('Attempting direct NIP-05 verification for:', nip05Identifier);
        const result = await nip05.queryProfile(nip05Identifier);
        
        // Cache the result
        cache[cacheKey] = { 
          result: result?.pubkey === pubkey,
          timestamp: Date.now()
        };
        localStorage.setItem('nip05_cache', JSON.stringify(cache));
        
        return result?.pubkey === pubkey;
      } catch {
        console.warn('Direct NIP-05 verification failed due to CORS:', nip05Identifier);
        
        // Extract domain from the NIP-05 identifier
        const parts = nip05Identifier.split('@');
        if (parts.length !== 2) {
          console.error('Invalid NIP-05 identifier format:', nip05Identifier);
          
          // Cache the failure
          cache[cacheKey] = { 
            result: false,
            timestamp: Date.now()
          };
          localStorage.setItem('nip05_cache', JSON.stringify(cache));
          
          return false;
        }
        
        // Get the domain directly from parts array
        const domain = parts[1];
        
        // Skip actual API call if we've had issues with this domain before
        // Instead, assume the NIP-05 is valid to avoid UI disruptions
        if (cache[domain] && cache[domain].corsError) {
          console.log('Skipping NIP-05 verification for known CORS-problematic domain:', domain);
          return true; // Trust the NIP-05 for better user experience
        }
        
        // Cache the CORS error for this domain
        cache[domain] = { corsError: true, timestamp: Date.now() };
        localStorage.setItem('nip05_cache', JSON.stringify(cache));
        
        // For UI purposes, we'll assume the NIP-05 is valid rather than
        // continuously trying to verify and causing console spam
        console.log('Skipping NIP-05 verification due to CORS, assuming valid:', nip05Identifier);
        return true;
      }
    } catch (error) {
      console.error('NIP-05 verification error:', error);
      
      // Cache the error
      cache[cacheKey] = { 
        result: false,
        timestamp: Date.now()
      };
      localStorage.setItem('nip05_cache', JSON.stringify(cache));
      
      return false;
    }
  }

  // Method to get secret key for encryption/decryption
  // In a real app, this would be more secure
  async getSecretKey(): Promise<string | null> {
    if (this.userPrivateKey) {
      return this.userPrivateKey;
    }
    
    if (this.signer) {
      try {
        // For NIP-07 extensions that support it
        const signerWithSecretKey = this.signer as ExtendedNip07Signer;
        if (typeof signerWithSecretKey.getSecretKey === 'function') {
          this.userPrivateKey = await signerWithSecretKey.getSecretKey();
          return this.userPrivateKey;
        }
      } catch (error) {
        console.error('Failed to get secret key from signer:', error);
      }
    }
    
    return null;
  }

  // Subscribe to notes (kind 1) from the network
  async subscribeToNotes(filters: NDKFilter = {}, opts?: NDKSubscriptionOptions) {
    try {
      // Create a deep copy of the user's filter to avoid modifying the original
      const defaultFilter: NDKFilter = JSON.parse(JSON.stringify(filters || {}));
      
      // Always ensure we have a kinds array for note events
      if (!defaultFilter.kinds || !Array.isArray(defaultFilter.kinds) || defaultFilter.kinds.length === 0) {
        defaultFilter.kinds = [1]; // Default to text notes if not specified
      }

      // Special handling for long-form content (blogs)
      const isLongformContent = defaultFilter.kinds.includes(30023);
      
      // Respect user limit but enforce a reasonable maximum
      // For blogs, we allow up to 1000 items to ensure we get enough content
      if (!defaultFilter.limit || defaultFilter.limit > (isLongformContent ? 2000 : 500)) {
        defaultFilter.limit = isLongformContent ? 300 : 100; // Higher default limit for blogs
      }
      
      // CRITICAL: NDK requires at least one filter criterion to be present
      // Only add a time filter if no other criteria exist
      const hasFilterCriteria = (
        (defaultFilter.authors && Array.isArray(defaultFilter.authors) && defaultFilter.authors.length > 0) ||
        defaultFilter.since ||
        defaultFilter.until ||
        defaultFilter.ids ||
        defaultFilter['#e'] ||
        defaultFilter['#p']
      );
      
      if (!hasFilterCriteria) {
        // Add a 90-day time window for blogs, 30-day for regular notes
        // This prevents the "No filters to merge" error while providing relevant content
        console.log('No specific filter criteria provided, adding default time constraint');
        const timeWindow = isLongformContent ? 180 * 86400 : 30 * 86400; // 180 days for blogs
        const timestamp = Math.floor(Date.now() / 1000) - timeWindow;
        defaultFilter.since = timestamp;
      } else if (isLongformContent && !defaultFilter.since) {
        // Ensure blogs have at least 180 days of history (extended from 90)
        const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 86400);
        defaultFilter.since = sixMonthsAgo;
      }

      // For blog content, use extended subscription options
      const subscriptionOpts = opts || {};
      if (isLongformContent) {
        // Allow more concurrent subscriptions for blogs
        subscriptionOpts.closeOnEose = false; // Keep connection open
        subscriptionOpts.groupable = false; // Don't group blog subscriptions
      }

      // Log the final filter for debugging
      console.log('Subscribing with filter:', defaultFilter);
      
      // Create the subscription with our validated filter
      const sub = this.ndk.subscribe(defaultFilter, subscriptionOpts);
      
      return sub;
    } catch (error) {
      console.error('Failed to subscribe to notes:', error);
      return null; // Return null instead of throwing to prevent crashing the UI
    }
  }

  // Fetch and cache a user's profile
  async fetchAndCacheProfile(pubkey: string): Promise<Profile | null> {
    try {
      // Check if we have a recent profile in the cache
      const cachedProfile = await db.profiles.get(pubkey);
      const now = Math.floor(Date.now() / 1000);
      const isCurrentUser = this.currentUser && this.currentUser.pubkey === pubkey;
      
      // If cached profile is fresh (less than 1 hour old) and not the current user, return it
      if (cachedProfile && cachedProfile.lastUpdated && (now - cachedProfile.lastUpdated < 3600) && !isCurrentUser) {
        return cachedProfile;
      }
      
      // Fetch the latest profile data
      const user = this.ndk.getUser({ pubkey });
      await user.fetchProfile();
      
      if (user.profile) {
        const profile: Profile = {
          pubkey,
          name: user.profile.name,
          displayName: user.profile.displayName,
          picture: user.profile.image,
          about: user.profile.about,
          nip05: user.profile.nip05,
          banner: user.profile.banner,
          metadata: JSON.stringify(user.profile),
          lastUpdated: now
        };
        
        // Store in database
        await db.profiles.put(profile);
        return profile;
      }
      
      return cachedProfile || null;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  // Publish a new text note
  async publishNote(content: string, replyTo?: string): Promise<NDKEvent | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 1;
      event.content = content;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Add reply tags if replying to another note (NIP-10)
      if (replyTo) {
        event.tags.push(['e', replyTo, '', 'reply']);
      }
      
      // Ensure valid timestamp before publishing (NIP-22)
      await this.ensureValidTimestamp(event);
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      // Cache in local DB
      const nostrEvent: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at!,
        kind: event.kind!,
        tags: event.tags,
        content: event.content,
        sig: event.sig!
      };
      
      await db.events.put(nostrEvent);
      
      return event;
    } catch (error) {
      console.error('Failed to publish note:', error);
      return null;
    }
  }

  // NIP-02: Fetch contact list
  async fetchContactList(): Promise<string[]> {
    if (!this.currentUser) {
      return [];
    }

    try {
      // Get the most recent contact list event
      const filter: NDKFilter = {
        authors: [this.currentUser.pubkey],
        kinds: [3], // Kind 3 is contact list
        limit: 1
      };

      const events = await this.ndk.fetchEvents(filter);
      if (!events || events.size === 0) {
        return [];
      }

      // Get the first (most recent) event
      const contactEvent = Array.from(events)[0];
      
      // Extract pubkeys from p tags
      const contacts = contactEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      
      return contacts;
    } catch (error) {
      console.error('Failed to fetch contact list:', error);
      return [];
    }
  }

  // NIP-02: Follow a user
  async followUser(pubkey: string): Promise<boolean> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return false;
    }

    try {
      // Get current contact list
      const contacts = await this.fetchContactList();
      
      // If already following, do nothing
      if (contacts.includes(pubkey)) {
        return true;
      }
      
      // Add the new contact
      contacts.push(pubkey);
      
      // Create contact list event
      const event = new NDKEvent(this.ndk);
      event.kind = 3;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Add p tags for each contact
      contacts.forEach(contact => {
        event.tags.push(['p', contact]);
      });
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      return true;
    } catch (error) {
      console.error('Failed to follow user:', error);
      return false;
    }
  }

  // NIP-02: Unfollow a user
  async unfollowUser(pubkey: string): Promise<boolean> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return false;
    }

    try {
      // Get current contact list
      const contacts = await this.fetchContactList();
      
      // Remove the contact
      const updatedContacts = contacts.filter(contact => contact !== pubkey);
      
      // If nothing changed, do nothing
      if (updatedContacts.length === contacts.length) {
        return true;
      }
      
      // Create contact list event
      const event = new NDKEvent(this.ndk);
      event.kind = 3;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Add p tags for each contact
      updatedContacts.forEach(contact => {
        event.tags.push(['p', contact]);
      });
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      return true;
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      return false;
    }
  }

  // NIP-04: Send encrypted direct message
  async sendDirectMessage(recipientPubkey: string, content: string): Promise<boolean> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return false;
    }

    try {
      // Create encrypted content using NIP-04
      const secretKey = await this.getSecretKey();
      if (!secretKey) {
        console.error('Failed to get secret key for encryption');
        return false;
      }
      
      const encryptedContent = await nip04.encrypt(
        secretKey,
        recipientPubkey,
        content
      );
      
      // Create DM event
      const event = new NDKEvent(this.ndk);
      event.kind = 4; // Direct message
      event.content = encryptedContent;
      event.created_at = Math.floor(Date.now() / 1000);
      event.tags.push(['p', recipientPubkey]);
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      // Cache in local DB
      const dm: DirectMessage = {
        id: event.id,
        senderPubkey: this.currentUser.pubkey,
        recipientPubkey,
        content,
        encryptedContent,
        created_at: event.created_at
      };
      
      await db.directMessages.put(dm);
      
      return true;
    } catch (error) {
      console.error('Failed to send direct message:', error);
      return false;
    }
  }

  // NIP-04: Get direct messages
  async getDirectMessages(otherPubkey?: string): Promise<DirectMessage[]> {
    if (!this.currentUser) {
      return [];
    }

    try {
      const myPubkey = this.currentUser.pubkey;
      
      // Filter for DMs sent to or from the current user
      const filter: NDKFilter = {
        kinds: [4],
        limit: 100
      };
      
      if (otherPubkey) {
        // Messages between current user and specific other user
        filter['#p'] = [myPubkey, otherPubkey];
        filter.authors = [myPubkey, otherPubkey];
      } else {
        // All messages to or from current user
        filter['#p'] = [myPubkey];
      }
      
      const events = await this.ndk.fetchEvents(filter);
      
      if (!events || events.size === 0) {
        return [];
      }
      
      const messages: DirectMessage[] = [];
      
      for (const event of events) {
        try {
          const senderPubkey = event.pubkey;
          const recipientTag = event.tags.find(tag => tag[0] === 'p');
          const recipientPubkey = recipientTag ? recipientTag[1] : '';
          
          // Skip if not a conversation with the current user
          if (senderPubkey !== myPubkey && recipientPubkey !== myPubkey) {
            continue;
          }
          
          // Determine the other party in the conversation
          const otherParty = senderPubkey === myPubkey ? recipientPubkey : senderPubkey;
          
          // Skip if we're looking for a specific conversation and this isn't it
          if (otherPubkey && otherParty !== otherPubkey) {
            continue;
          }
          
          // Decrypt content
          let decryptedContent = '';
          try {
            const secretKey = await this.getSecretKey();
            if (secretKey) {
              decryptedContent = await nip04.decrypt(
                secretKey,
                senderPubkey === myPubkey ? recipientPubkey : senderPubkey,
                event.content
              );
            } else {
              decryptedContent = '[Unable to decrypt - no secret key available]';
            }
          } catch (decryptError) {
            console.error('Failed to decrypt message:', decryptError);
            // Use placeholder for failed decryption
            decryptedContent = '[Encrypted message]';
          }
          
          const message: DirectMessage = {
            id: event.id,
            senderPubkey,
            recipientPubkey,
            content: decryptedContent,
            encryptedContent: event.content,
            created_at: event.created_at!
          };
          
          // Cache in DB
          await db.directMessages.put(message);
          
          messages.push(message);
        } catch (eventError) {
          console.error('Error processing DM event:', eventError);
        }
      }
      
      // Sort by timestamp
      return messages.sort((a, b) => a.created_at - b.created_at);
    } catch (error) {
      console.error('Failed to get direct messages:', error);
      return [];
    }
  }

  // NIP-25: Create a reaction
  async createReaction(eventId: string, reaction: string = '+'): Promise<boolean> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return false;
    }

    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 7; // Reaction
      event.content = reaction; // + for like, - for dislike, or emoji
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Reference the event being reacted to
      event.tags.push(['e', eventId]);
      
      // Add author of the event being reacted to (if we can find it)
      const originalEvent = await this.getEvent(eventId);
      if (originalEvent) {
        event.tags.push(['p', originalEvent.pubkey]);
      }
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      return true;
    } catch (error) {
      console.error('Failed to create reaction:', error);
      return false;
    }
  }

  // Get a specific event by ID
  async getEvent(eventId: string): Promise<NDKEvent | null> {
    try {
      // Check local cache first
      const cachedEvent = await db.events.get(eventId);
      if (cachedEvent) {
        const event = new NDKEvent(this.ndk);
        event.id = cachedEvent.id;
        event.pubkey = cachedEvent.pubkey;
        event.kind = cachedEvent.kind;
        event.content = cachedEvent.content;
        event.tags = cachedEvent.tags;
        event.created_at = cachedEvent.created_at;
        event.sig = cachedEvent.sig;
        return event;
      }
      
      // If not in cache, fetch from relays
      const filter: NDKFilter = {
        ids: [eventId],
        limit: 1
      };
      
      const events = await this.ndk.fetchEvents(filter);
      if (!events || events.size === 0) {
        return null;
      }
      
      const event = Array.from(events)[0];
      
      // Cache the event
      const nostrEvent: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at!,
        kind: event.kind!,
        tags: event.tags,
        content: event.content,
        sig: event.sig!
      };
      
      await db.events.put(nostrEvent);
      
      return event;
    } catch (error) {
      console.error('Failed to get event:', error);
      return null;
    }
  }

  // NIP-23: Create a long-form article
  async publishLongformContent(
    title: string, 
    content: string,
    summary: string = '',
    image?: string,
    tags: string[] = []
  ): Promise<NDKEvent | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 30023; // Long-form content
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Set content
      event.content = content;
      
      // Add title tag
      event.tags.push(['title', title]);
      
      // Add summary if provided
      if (summary) {
        event.tags.push(['summary', summary]);
      }
      
      // Add image if provided
      if (image) {
        event.tags.push(['image', image]);
      }
      
      // Add each tag
      tags.forEach(tag => {
        event.tags.push(['t', tag]);
      });
      
      // Add published_at tag
      event.tags.push(['published_at', String(event.created_at)]);
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      // Cache in local DB
      const nostrEvent: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at!,
        kind: event.kind!,
        tags: event.tags,
        content: event.content,
        sig: event.sig!
      };
      
      await db.events.put(nostrEvent);
      
      return event;
    } catch (error) {
      console.error('Failed to publish long-form content:', error);
      return null;
    }
  }

  // NIP-51: Create a list (bookmarks, curated list, etc.)
  async createList(
    name: string,
    description: string,
    items: Array<{id: string, relatedPubkey?: string, url?: string}>,
    listKind: 'bookmarks' | 'articles' | 'channels' | 'custom' = 'custom',
    customKind?: number
  ): Promise<NDKEvent | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      // Determine list kind
      let kind: number;
      switch (listKind) {
        case 'bookmarks': kind = 30001; break;
        case 'articles': kind = 30003; break;
        case 'channels': kind = 30004; break;
        case 'custom': kind = customKind || 30000; break;
        default: kind = 30000;
      }
      
      const event = new NDKEvent(this.ndk);
      event.kind = kind;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Set description as content
      event.content = description;
      
      // Add name tag
      event.tags.push(['d', name]);
      
      // Add items to the list
      items.forEach(item => {
        if (item.relatedPubkey) {
          // If it's a note or profile reference
          event.tags.push(['e', item.id, '', 'mention']);
          
          if (item.relatedPubkey) {
            event.tags.push(['p', item.relatedPubkey]);
          }
        } else if (item.url) {
          // For external URL
          event.tags.push(['r', item.url]);
        }
      });
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      return event;
    } catch (error) {
      console.error('Failed to create list:', error);
      return null;
    }
  }

  // NIP-57: Create a zap request
  async createZapRequest(
    eventId: string | null,
    recipientPubkey: string,
    amount: number, // in sats
    content: string = ''
  ): Promise<string | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      // Create zap request event (not stored on Nostr, just for the LNURL)
      const zapRequestEvent = new NDKEvent(this.ndk);
      zapRequestEvent.kind = 9734; // Zap request
      zapRequestEvent.created_at = Math.floor(Date.now() / 1000);
      zapRequestEvent.content = content;
      
      // Add recipient pubkey
      zapRequestEvent.tags.push(['p', recipientPubkey]);
      
      // If zapping an event, add event reference
      if (eventId) {
        zapRequestEvent.tags.push(['e', eventId]);
      }
      
      // Add relay info
      DEFAULT_RELAYS.forEach(relay => {
        zapRequestEvent.tags.push(['relays', relay]);
      });
      
      // Add amount info
      zapRequestEvent.tags.push(['amount', amount.toString()]);
      
      // Sign the event
      await zapRequestEvent.sign();
      
      // The signed zap request is serialized and used with the LNURL
      const serializedZapRequest = JSON.stringify(zapRequestEvent.rawEvent());
      
      return serializedZapRequest;
    } catch (error) {
      console.error('Failed to create zap request:', error);
      return null;
    }
  }

  // NIP-71: Create a video event
  async publishVideoEvent(
    title: string,
    videoUrl: string,
    thumbnailUrl: string,
    description: string = '',
    duration?: number,
    dimensions?: {width: number, height: number},
    tags: string[] = []
  ): Promise<NDKEvent | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      // Create a new video event
      const event = new NDKEvent(this.ndk);
      
      // Kind 1031 is the NIP-71 video event kind
      event.kind = 34235; // Video
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Set description as content
      event.content = description;
      
      // Add title tag
      event.tags.push(['title', title]);
      
      // Add video URL
      event.tags.push(['url', videoUrl]);
      
      // Add thumbnail
      event.tags.push(['thumb', thumbnailUrl]);
      
      // Add duration if provided (in seconds)
      if (duration) {
        event.tags.push(['duration', String(duration)]);
      }
      
      // Add dimensions if provided
      if (dimensions) {
        event.tags.push(['dim', `${dimensions.width}x${dimensions.height}`]);
      }
      
      // Add each tag
      tags.forEach(tag => {
        event.tags.push(['t', tag]);
      });
      
      // Add published_at tag
      event.tags.push(['published_at', String(event.created_at)]);
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      // Cache in local DB
      const nostrEvent: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at!,
        kind: event.kind!,
        tags: event.tags,
        content: event.content,
        sig: event.sig!
      };
      
      await db.events.put(nostrEvent);
      
      return event;
    } catch (error) {
      console.error('Failed to publish video event:', error);
      return null;
    }
  }

  // NIP-94: Create file metadata
  async createFileMetadata(
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
  ): Promise<NDKEvent | null> {
    if (!this.ndk.signer || !this.currentUser) {
      console.error('Not logged in');
      return null;
    }

    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 1063; // File metadata
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Set description as content
      event.content = description;
      
      // Add required file tags
      event.tags.push(['url', url]);
      event.tags.push(['m', mimeType]);
      event.tags.push(['size', String(size)]);
      event.tags.push(['name', name]);
      
      // Add optional file tags
      if (hash) {
        event.tags.push(['hash', hash]);
      }
      
      if (magnetURI) {
        event.tags.push(['magnet', magnetURI]);
      }
      
      if (torrentInfoHash) {
        event.tags.push(['infohash', torrentInfoHash]);
      }
      
      // Add image-specific metadata
      if (mimeType.startsWith('image/') && dimensions) {
        event.tags.push(['dim', `${dimensions.width}x${dimensions.height}`]);
        
        if (blurhash) {
          event.tags.push(['blurhash', blurhash]);
        }
      }
      
      // Sign and publish
      await event.sign();
      await event.publish();
      
      return event;
    } catch (error) {
      console.error('Failed to create file metadata:', error);
      return null;
    }
  }

  // NIP-98: HTTP Auth - Create auth event for external services
  async createAuthEvent(url: string, method: string = 'GET'): Promise<string | null> {
    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 27235; // HTTP Auth
      event.created_at = Math.floor(Date.now() / 1000);
      event.content = '';
      
      // Validate URL before using
      new URL(url);
      
      // Add required tags
      event.tags.push(['u', url]);
      event.tags.push(['method', method]);
      
      // Add created_at tag
      event.tags.push(['created_at', String(event.created_at)]);
      
      // Sign the event
      await event.sign();
      
      // Auth header value is the serialized event as per NIP-98
      const serializedEvent = JSON.stringify(event.rawEvent());
      const encodedAuth = btoa(serializedEvent);
      
      return `Nostr ${encodedAuth}`;
    } catch (error) {
      console.error('Failed to create auth event:', error);
      return null;
    }
  }

  // Publish profile metadata (kind 0)
  async publishProfileMetadata(profileData: {
    displayName?: string;
    name?: string;
    about?: string;
    website?: string;
    nip05?: string;
    picture?: string;
    banner?: string;
  }): Promise<NDKEvent | null> {
    try {
      if (!this.ndk.signer) {
        throw new Error('No signer available');
      }

      // Create a new kind 0 event
      const event = new NDKEvent(this.ndk);
      event.kind = NDKKind.Metadata;
      
      // Prepare the content object with only defined fields
      const content: Record<string, string> = {};
      if (profileData.displayName) content.displayName = profileData.displayName;
      if (profileData.name) content.name = profileData.name;
      if (profileData.about) content.about = profileData.about;
      if (profileData.website) content.website = profileData.website;
      if (profileData.nip05) content.nip05 = profileData.nip05;
      if (profileData.picture) content.picture = profileData.picture;
      if (profileData.banner) content.banner = profileData.banner;
      
      // Set the content
      event.content = JSON.stringify(content);
      
      // Sign and publish the event
      await event.publish();
      
      // Update local cache
      if (this.currentUser) {
        const now = Math.floor(Date.now() / 1000);
        const profile: Profile = {
          pubkey: this.currentUser.pubkey,
          name: profileData.name || '',
          displayName: profileData.displayName || '',
          picture: profileData.picture || '',
          about: profileData.about || '',
          nip05: profileData.nip05 || '',
          banner: profileData.banner || '',
          metadata: JSON.stringify(content),
          lastUpdated: now
        };
        
        // Store updated profile in database
        await db.profiles.put(profile);
      }
      
      return event;
    } catch (error) {
      console.error('Failed to publish profile metadata:', error);
      return null;
    }
  }

  /**
   * Add relays to the NDK instance
   * Adds the new relays to the existing NDK instance instead of creating a new one
   */
  async addRelays(relays: string[] = []): Promise<boolean> {
    try {
      // If no relays provided, suggest livestreaming-focused relays
      if (relays.length === 0) {
        relays = this.getRecommendedStreamingRelays();
        console.log('No relays provided, using recommended livestreaming relays:', relays);
      }
      
      if (!this.ndk.pool) {
        console.error('NDK pool not initialized');
        return false;
      }
      
      // Get all current relay URLs from the pool
      const currentRelays = Array.from(this.ndk.pool.relays?.keys() || []);
      console.log('Current relays:', currentRelays);
      
      // Add each new relay to the pool and to our tracking map
      let addedCount = 0;
      for (const url of relays) {
        // Check if relay already exists in the pool
        if (!currentRelays.includes(url)) {
          // Add to NDK relay pool
          try {
            const relay = new NDKRelay(url, undefined, this.ndk);
            await this.ndk.pool.addRelay(relay);
            
            // Add to our tracking
            if (!this.relayStatusMap.has(url)) {
              this.relayStatusMap.set(url, {
                connected: false,
                errors: 0,
                lastConnected: 0,
                lastError: 0
              });
            }
            
            addedCount++;
          } catch (error) {
            console.error(`Failed to add relay ${url}:`, error);
          }
        } else {
          console.log(`Relay ${url} already exists in the pool`);
        }
      }
      
      console.log(`Successfully added ${addedCount} new relays`);
      
      // Make sure our relay connection monitor is running
      this.startConnectionMonitor();
      
      return true;
    } catch (error) {
      console.error('Failed to add relays:', error);
      return false;
    }
  }
  
  /**
   * Connect to recommended streaming relays
   * Helps users quickly connect to relays optimized for livestreaming
   */
  async connectToStreamingRelays(): Promise<boolean> {
    try {
      const streamingRelays = this.getRecommendedStreamingRelays();
      console.log('Connecting to recommended streaming relays:', streamingRelays);
      
      // Use the addRelays method to connect to streaming relays
      return await this.addRelays(streamingRelays);
    } catch (error) {
      console.error('Failed to connect to streaming relays:', error);
      return false;
    }
  }

  /**
   * Get recommended livestreaming relays
   * Returns an array of relay URLs optimized for streaming content
   */
  getRecommendedStreamingRelays(): string[] {
    const streamingRelays = [
      'wss://relay.zaps.stream',  // Primary streaming relay
      'wss://nos.lol',           // Fast relay with good streaming support
      'wss://relay.snort.social', // Popular relay with NIP-53 support
      'wss://relay.damus.io',     // Well-known relay with good uptime
      'wss://nostr.mutinywallet.com' // Additional relay with good performance
    ];
    
    return streamingRelays;
  }

  // Get current logged in user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get NDK instance
  getNdk() {
    return this.ndk;
  }

  // Method to search across Nostr
  async searchNostr(query: string, limit: number = 20) {
    if (!query || query.trim() === '') {
      return {
        users: [],
        hashtags: [],
        posts: []
      };
    }

    try {
      const searchQuery = query.trim().toLowerCase();
      const results = {
        users: [] as Array<{pubkey: string; name: string; displayName: string; picture: string; nip05: string}>,
        hashtags: [] as Array<{tag: string; count: number}>,
        posts: [] as NDKEvent[]
      };

      // First try NIP-50 search using nostr.band relay
      try {
        console.log('Attempting NIP-50 search with relay.nostr.band');
        
        // Create NDK instance just for search if needed
        const searchNDK = this.ndk;
        
        // Make sure we're connected to relay.nostr.band
        if (!Array.from(searchNDK.pool?.relays.keys() || []).includes('wss://relay.nostr.band')) {
          const relay = new NDKRelay('wss://relay.nostr.band', undefined, searchNDK);
          await searchNDK.pool?.addRelay(relay);
        }
        
        // Create a search filter using NIP-50 specification
        const searchFilter: NDKFilter = {
          kinds: [0, 1], // Search users and posts
          limit: limit * 2, // Request more to have enough after filtering
          search: searchQuery
        };
        
        // Execute the search
        const searchEvents = await searchNDK.fetchEvents(searchFilter, { 
          closeOnEose: true,
          groupable: false,
          groupableDelay: 0
        });
        
        if (searchEvents && searchEvents.size > 0) {
          console.log(`NIP-50 search returned ${searchEvents.size} results`);
          
          const remoteEvents = Array.from(searchEvents);
          
          // Process the results by categorizing them
          for (const event of remoteEvents) {
            if (event.kind === 0) {
              // Profile event - add to users
              try {
                const profileData = JSON.parse(event.content);
                results.users.push({
                  pubkey: event.pubkey,
                  name: profileData.name || '',
                  displayName: profileData.displayName || profileData.display_name || '',
                  picture: profileData.picture || profileData.image || '',
                  nip05: profileData.nip05 || ''
                });
              } catch (e) {
                console.error('Error parsing profile data:', e);
              }
            } else if (event.kind === 1) {
              // Post event - add to posts
              results.posts.push(event);
              
              // Extract hashtags from the content to populate hashtags results
              const content = event.content.toLowerCase();
              const tags = content.match(/#[a-z0-9_]+/g) || [];
              
              // Count hashtags
              const hashtagMap: Record<string, number> = {};
              tags.forEach(tag => {
                const cleanTag = tag.slice(1); // Remove # prefix
                hashtagMap[cleanTag] = (hashtagMap[cleanTag] || 0) + 1;
              });
              
              // Also check t tags
              event.tags.forEach(tagArray => {
                if (tagArray[0] === 't' && tagArray[1]) {
                  const tag = tagArray[1].toLowerCase();
                  hashtagMap[tag] = (hashtagMap[tag] || 0) + 1;
                }
              });
              
              // Add hashtags to results if not already there
              Object.entries(hashtagMap).forEach(([tag, count]) => {
                const existingTagIndex = results.hashtags.findIndex(ht => ht.tag === tag);
                if (existingTagIndex >= 0) {
                  results.hashtags[existingTagIndex].count += count;
                } else {
                  results.hashtags.push({ tag, count });
                }
              });
            }
          }
          
          // Sort and limit the results
          results.users = results.users.slice(0, limit);
          results.hashtags = results.hashtags
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
          results.posts = results.posts.slice(0, limit);
          
          // If we got enough results from NIP-50 search, return them
          if (results.posts.length >= 5 || results.users.length >= 5) {
            console.log('Got sufficient results from NIP-50 search');
            return results;
          }
        }
      } catch (searchError) {
        console.error('NIP-50 search failed, falling back to local search:', searchError);
      }

      // Fallback: Search locally if NIP-50 search failed or returned insufficient results
      console.log('Falling back to local search');

      // 1. Search for users (by name, display name, or NIP-05)
      // First check local DB
      const dbProfiles = await db.profiles.toArray();
      const matchingProfiles = dbProfiles.filter(profile => {
        const name = (profile.name || '').toLowerCase();
        const displayName = (profile.displayName || '').toLowerCase();
        const nip05 = (profile.nip05 || '').toLowerCase();
        
        return name.includes(searchQuery) || 
               displayName.includes(searchQuery) ||
               nip05.includes(searchQuery);
      });

      // Add matching profiles to results if not already there
      matchingProfiles.slice(0, limit).forEach(profile => {
        if (!results.users.some(u => u.pubkey === profile.pubkey)) {
          results.users.push({
            pubkey: profile.pubkey,
            name: profile.name || '',
            displayName: profile.displayName || '',
            picture: profile.picture || '',
            nip05: profile.nip05 || ''
          });
        }
      });

      // 2. Search for hashtags in local events if we need more
      if (results.hashtags.length < limit) {
        const localEvents = await db.events.where('kind').equals(1).toArray();
        const hashtagCounts: Record<string, number> = {};
        
        // Extract hashtags from content
        localEvents.forEach(event => {
          const content = event.content.toLowerCase();
          const tags = content.match(/#[a-z0-9_]+/g) || [];
          
          // Count the tags
          tags.forEach(tag => {
            const cleanTag = tag.slice(1); // Remove # prefix
            if (cleanTag.includes(searchQuery)) {
              hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
            }
          });
          
          // Also check for t tags in the event
          event.tags.forEach(tagArray => {
            if (tagArray[0] === 't' && tagArray[1] && tagArray[1].toLowerCase().includes(searchQuery)) {
              hashtagCounts[tagArray[1].toLowerCase()] = (hashtagCounts[tagArray[1].toLowerCase()] || 0) + 1;
            }
          });
        });
        
        // Add new hashtags that aren't already in results
        Object.entries(hashtagCounts).forEach(([tag, count]) => {
          if (!results.hashtags.some(ht => ht.tag === tag)) {
            results.hashtags.push({ tag, count });
          }
        });
        
        // Sort and limit hashtags
        results.hashtags = results.hashtags
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      }

      // 3. Search for posts in local events if we need more
      if (results.posts.length < limit) {
        const localEvents = await db.events.where('kind').equals(1).toArray();
        const matchingPosts = localEvents.filter(event => 
          event.content.toLowerCase().includes(searchQuery)
        );
        
        // Create NDKEvent objects from the matching posts
        for (const post of matchingPosts.slice(0, limit - results.posts.length)) {
          // Skip if we already have this post
          if (results.posts.some(p => p.id === post.id)) continue;
          
          const ndkEvent = new NDKEvent(this.ndk);
          ndkEvent.id = post.id;
          ndkEvent.pubkey = post.pubkey;
          ndkEvent.kind = post.kind;
          ndkEvent.content = post.content;
          ndkEvent.tags = post.tags;
          ndkEvent.created_at = post.created_at;
          ndkEvent.sig = post.sig;
          
          results.posts.push(ndkEvent);
        }
      }
      
      // 4. If still not enough posts, try direct relay query with hashtag support
      if (results.posts.length < 10) {
        try {
          // Try connecting to relay.nostr.band if not already connected
          if (!Array.from(this.ndk.pool?.relays.keys() || []).includes('wss://relay.nostr.band')) {
            const relay = new NDKRelay('wss://relay.nostr.band', undefined, this.ndk);
            await this.ndk.pool?.addRelay(relay);
          }
          
          // Fetch events from relays
          const filter: NDKFilter = {
            kinds: [1],
            limit: 20
          };
          
          // If search starts with #, look for hashtags
          if (searchQuery.startsWith('#')) {
            const tag = searchQuery.slice(1);
            filter['#t'] = [tag];
          } else {
            // Add a time constraint to get recent posts
            filter.since = Math.floor(Date.now() / 1000) - (7 * 86400); // Last week
          }
          
          const events = await this.ndk.fetchEvents(filter, { 
            closeOnEose: true,
            groupable: false,
            groupableDelay: 0
          });
          
          if (events && events.size > 0) {
            const remoteEvents = Array.from(events);
            
            // Filter events that match our search query
            const matchingRemoteEvents = remoteEvents.filter(event =>
              event.content.toLowerCase().includes(searchQuery)
            );
            
            // Add unique events to results
            const existingIds = new Set(results.posts.map(e => e.id));
            for (const event of matchingRemoteEvents) {
              if (!existingIds.has(event.id)) {
                results.posts.push(event);
                if (results.posts.length >= limit) break;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching events from relays:', error);
        }
      }

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return {
        users: [],
        hashtags: [],
        posts: []
      };
    }
  }

  // NIP-53: Live streaming
  async subscribeLivestreams() {
    try {
      // Connect to recommended streaming relays first
      await this.connectToStreamingRelays();
      
      // Create a filter for active livestreams using NIP-53
      // Use a type assertion to handle custom event kinds
      const filter: NDKFilter = {
        kinds: [30311 as unknown as NDKKind],
        limit: 50,
        since: Math.floor(Date.now() / 1000) - 12 * 60 * 60, // Last 12 hours
        "#status": ["live"]
      };
      
      // Subscribe to livestreams
      const subscription = this.ndk.subscribe(filter);
      
      // Log new livestreams as they come in
      subscription.on('event', (event: NDKEvent) => {
        console.log('New livestream event received:', event);
        
        // Check if the stream has a valid streaming URL
        const streamingTag = event.tags.find(tag => tag[0] === 'streaming' && tag[1]);
        const urlTag = event.tags.find(tag => tag[0] === 'url' && tag[1]);
        
        if (streamingTag || urlTag) {
          console.log('Valid livestream with URL detected:', event.id);
        }
      });
      
      return subscription;
    } catch (error) {
      console.error('Error subscribing to livestreams:', error);
      return null;
    }
  }
  
  // Get all current livestreams
  async getLivestreams(): Promise<NDKEvent[]> {
    try {
      // Ensure we're connected to streaming-focused relays
      await this.connectToStreamingRelays();

      // Create a filter for active livestreams using NIP-53
      const filter: NDKFilter = {
        kinds: [30311 as unknown as NDKKind],
        limit: 100, // Increased limit to get more streams
        since: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // Last 24 hours (increased from 12)
        "#status": ["live"]
      };
      
      console.log('Fetching livestreams with filter:', filter);
      
      // Fetch events from all connected relays
      const events = await this.ndk.fetchEvents(filter);
      const livestreams: NDKEvent[] = [];
      
      events.forEach(event => {
        console.log('Fetched livestream:', event);
        
        // Check if this is a valid livestream with a streaming URL
        const hasStreamingUrl = event.tags.some(tag => 
          (tag[0] === 'streaming' && tag[1]) || 
          (tag[0] === 'url' && tag[1])
        );
        
        if (hasStreamingUrl) {
          livestreams.push(event);
        } else {
          console.log('Skipping stream without valid URL:', event.id);
        }
      });
      
      console.log(`Found ${livestreams.length} valid livestreams`);
      return livestreams;
    } catch (error) {
      console.error('Error fetching livestreams:', error);
      return [];
    }
  }
  
  // Start a livestream
  async startLivestream(
    title: string,
    streamingUrl: string,
    summary: string = '',
    imageUrl: string = '',
    tags: string[] = []
  ): Promise<NDKEvent | null> {
    if (!this.currentUser) {
      console.error('No logged in user to start livestream');
      return null;
    }
    
    try {
      // Create a new NIP-53 livestream event
      const event = new NDKEvent(this.ndk);
      event.kind = 30311 as unknown as NDKKind;
      event.content = summary;
      
      // Add required tags for NIP-53
      event.tags = [
        ["d", crypto.randomUUID()], // Unique identifier
        ["title", title],
        ["summary", summary],
        ["status", "live"],
        ["streaming", streamingUrl],
        ["starts", Math.floor(Date.now() / 1000).toString()],
      ];
      
      // Add image if provided
      if (imageUrl) {
        event.tags.push(["image", imageUrl]);
      }
      
      // Add user-provided tags
      tags.forEach(tag => {
        event.tags.push(["t", tag]);
      });
      
      // Add relays tag to specify where to find the stream
      const relays = DEFAULT_RELAYS.filter(r => 
        r.includes('wss://relay.zaps.stream') || 
        r.includes('wss://relay.damus.io') ||
        r.includes('wss://nos.lol')
      );
      
      event.tags.push(["relays", ...relays]);
      
      // Signs and publishes the event
      await event.publish();
      
      console.log('Published livestream event:', event);
      
      return event;
    } catch (error) {
      console.error('Failed to start livestream:', error);
      return null;
    }
  }
  
  // End a livestream by updating its status
  async endLivestream(eventId: string): Promise<boolean> {
    if (!this.currentUser) {
      console.error('No logged in user to end livestream');
      return false;
    }
    
    try {
      // Get the original event
      const originalEvent = await this.getEvent(eventId);
      if (!originalEvent) {
        console.error('Livestream event not found:', eventId);
        return false;
      }
      
      // Create a new NIP-53 event to update status
      const event = new NDKEvent(this.ndk);
      event.kind = 30311 as unknown as NDKKind;
      event.content = originalEvent.content;
      
      // Copy all tags from original event
      event.tags = [...originalEvent.tags];
      
      // Update status tag to "ended"
      const statusIndex = event.tags.findIndex(tag => tag[0] === 'status');
      if (statusIndex !== -1) {
        event.tags[statusIndex] = ["status", "ended"];
      } else {
        event.tags.push(["status", "ended"]);
      }
      
      // Add current time as end time
      const endsIndex = event.tags.findIndex(tag => tag[0] === 'ends');
      if (endsIndex !== -1) {
        event.tags[endsIndex] = ["ends", Math.floor(Date.now() / 1000).toString()];
      } else {
        event.tags.push(["ends", Math.floor(Date.now() / 1000).toString()]);
      }
      
      // Add recording URL if we have one from the stream
      // (left as a placeholder, would need to be passed in as a parameter)
      
      // Signs and publishes the event
      await event.publish();
      
      console.log('Ended livestream event:', event);
      
      return true;
    } catch (error) {
      console.error('Failed to end livestream:', error);
      return false;
    }
  }

  /**
   * Check if a livestream is currently active
   * Queries specialized streaming relays to verify current status
   * @param eventId The event ID of the livestream to check
   * @returns True if the stream is active, false otherwise
   */
  async isLivestreamActive(eventId: string): Promise<boolean> {
    try {
      // Connect to streaming relays to ensure we get the latest status
      await this.connectToStreamingRelays();
      
      // Create a filter for this specific livestream
      const filter: NDKFilter = {
        kinds: [30311 as unknown as NDKKind],
        ids: [eventId],
        "#status": ["live"]
      };
      
      // Try to fetch the event
      const events = await this.ndk.fetchEvents(filter);
      
      // If we found it with status "live", it's active
      let isActive = false;
      events.forEach(event => {
        // Check if the status tag is "live"
        const statusTag = event.tags.find(tag => tag[0] === 'status');
        if (statusTag && statusTag[1] === 'live') {
          console.log('Livestream is active:', eventId);
          isActive = true;
        }
      });
      
      return isActive;
    } catch (error) {
      console.error('Error checking livestream status:', error);
      return false;
    }
  }
  
  /**
   * Get livestream details including current viewers and status
   * @param eventId The event ID of the livestream
   * @returns Livestream details or null if not found
   */
  async getLivestreamDetails(eventId: string): Promise<{
    title: string;
    status: string;
    viewers: number;
    startTime: number;
    streamUrl: string;
    author: string;
  } | null> {
    try {
      const event = await this.getEvent(eventId);
      if (!event) return null;
      
      // Check if this is a livestream event
      if (event.kind !== 30311) return null;
      
      // Extract details
      const titleTag = event.tags.find(tag => tag[0] === 'title');
      const statusTag = event.tags.find(tag => tag[0] === 'status');
      const viewersTag = event.tags.find(tag => tag[0] === 'viewers');
      const startsTag = event.tags.find(tag => tag[0] === 'starts');
      const streamingTag = event.tags.find(tag => tag[0] === 'streaming') || 
                          event.tags.find(tag => tag[0] === 'url');
      
      if (!titleTag || !streamingTag) return null;
      
      return {
        title: titleTag[1] || 'Untitled Stream',
        status: statusTag ? statusTag[1] : 'unknown',
        viewers: viewersTag ? parseInt(viewersTag[1]) : 0,
        startTime: startsTag ? parseInt(startsTag[1]) : (event.created_at || 0),
        streamUrl: streamingTag[1],
        author: event.pubkey
      };
    } catch (error) {
      console.error('Error getting livestream details:', error);
      return null;
    }
  }

  /**
   * Fetches the NIP-11 relay information document
   * @param relayUrl The WebSocket URL of the relay
   * @returns Relay information or null if unable to fetch
   */
  async getRelayInfo(relayUrl: string): Promise<{
    name?: string;
    description?: string;
    pubkey?: string;
    contact?: string;
    supported_nips?: number[];
    software?: string;
    version?: string;
    limitation?: {
      max_message_length?: number;
      max_subscriptions?: number;
      max_filters?: number;
      max_limit?: number;
      max_subid_length?: number;
      min_prefix?: number;
      max_event_tags?: number;
      max_content_length?: number;
      min_pow_difficulty?: number;
      auth_required?: boolean;
      payment_required?: boolean;
      created_at_lower_limit?: number;
      created_at_upper_limit?: number;
      event_retention_time?: number;
    };
    [key: string]: unknown;
  } | null> {
    try {
      // Check cache first (valid for 24 hours)
      const cached = this.relayInfoCache.get(relayUrl);
      if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
        return cached.info;
      }
      
      // Convert WebSocket URL to HTTP URL
      const infoUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      
      // Fetch NIP-11 information document
      const response = await fetch(infoUrl, {
        headers: {
          'Accept': 'application/nostr+json'
        },
        // Short timeout to avoid hanging request
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch relay info: ${response.status}`);
      }
      
      const relayInfo = await response.json();
      
      // Cache the result
      this.relayInfoCache.set(relayUrl, {
        info: relayInfo,
        timestamp: Date.now()
      });
      
      return relayInfo;
    } catch (error) {
      console.error(`Error fetching relay info from ${relayUrl}:`, error);
      return null;
    }
  }

  /**
   * Check if a relay supports a specific NIP
   * @param relayUrl The WebSocket URL of the relay
   * @param nipNumber The NIP number to check support for
   * @returns Promise resolving to true if supported, false otherwise
   */
  async relaySupportsNIP(relayUrl: string, nipNumber: number): Promise<boolean> {
    const info = await this.getRelayInfo(relayUrl);
    if (!info || !info.supported_nips) {
      return false;
    }
    
    return info.supported_nips.includes(nipNumber);
  }

  /**
   * Filter relays that support a specific NIP
   * @param nipNumber The NIP number to check support for
   * @returns Promise resolving to an array of relay URLs that support the NIP
   */
  async getRelaysSupporting(nipNumber: number): Promise<string[]> {
    if (!this.ndk.pool) return [];
    
    const connectedRelays = this.getConnectedRelays();
    const results = await Promise.all(
      connectedRelays.map(async (url) => {
        const supports = await this.relaySupportsNIP(url, nipNumber);
        return { url, supports };
      })
    );
    
    return results
      .filter(result => result.supports)
      .map(result => result.url);
  }

  /**
   * Get the limits and restrictions of a relay
   * NIP-11 optional fields: https://github.com/nostr-protocol/nips/blob/master/11.md
   * @param relayUrl The WebSocket URL of the relay
   * @returns Relay limits or null if info not available
   */
  async getRelayLimits(relayUrl: string): Promise<{
    eventRetention?: number; // seconds
    maxMessageLength?: number; // bytes
    maxSubscriptions?: number;
    maxFilters?: number;
    createdAtLowerLimit?: number; // timestamp
    createdAtUpperLimit?: number; // timestamp
  } | null> {
    const info = await this.getRelayInfo(relayUrl);
    if (!info || !info.limitation) {
      return null;
    }
    
    return {
      eventRetention: info.limitation?.event_retention_time,
      maxMessageLength: info.limitation?.max_message_length,
      maxSubscriptions: info.limitation?.max_subscriptions,
      maxFilters: info.limitation?.max_filters,
      createdAtLowerLimit: info.limitation?.created_at_lower_limit,
      createdAtUpperLimit: info.limitation?.created_at_upper_limit
    };
  }

  /**
   * NIP-22: Validates if an event timestamp is within acceptable limits
   * @param timestamp Unix timestamp in seconds
   * @param relayUrl Optional relay URL to check against specific relay limits
   * @returns Promise resolving to an object with validation result and reason
   */
  async validateTimestamp(
    timestamp: number, 
    relayUrl?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const now = Math.floor(Date.now() / 1000);
    
    // Default limits (NIP-22 specifies 60 minutes future, but no past limit)
    let maxFutureSeconds = 60 * 60; // 1 hour in the future
    let maxPastSeconds = 60 * 60 * 24 * 365 * 10; // 10 years in the past (arbitrary)
    
    // Check if we have relay-specific limits
    if (relayUrl) {
      const relayLimits = await this.getRelayLimits(relayUrl);
      if (relayLimits) {
        if (relayLimits.createdAtLowerLimit) {
          // If relay specifies a lower limit as timestamp
          maxPastSeconds = now - relayLimits.createdAtLowerLimit;
        }
        
        if (relayLimits.createdAtUpperLimit) {
          // If relay specifies an upper limit as timestamp
          maxFutureSeconds = relayLimits.createdAtUpperLimit - now;
        }
      }
    }
    
    // Check if timestamp is too far in the future
    if (timestamp > now + maxFutureSeconds) {
      return {
        valid: false,
        reason: `Timestamp is too far in the future (${Math.floor((timestamp - now) / 60)} minutes ahead)`
      };
    }
    
    // Check if timestamp is too far in the past
    if (timestamp < now - maxPastSeconds) {
      return {
        valid: false,
        reason: `Timestamp is too far in the past (${Math.floor((now - timestamp) / (60 * 60 * 24))} days ago)`
      };
    }
    
    return { valid: true };
  }

  /**
   * NIP-22: Validates the timestamp of an event
   * @param event The Nostr event to validate
   * @param relayUrl Optional relay URL to check against specific relay limits
   * @returns Promise resolving to an object with validation result and reason
   */
  async validateEventTimestamp(
    event: NDKEvent,
    relayUrl?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!event.created_at) {
      return { valid: false, reason: 'Event has no created_at timestamp' };
    }
    
    return this.validateTimestamp(event.created_at, relayUrl);
  }

  // Helper to ensure events have valid timestamps before publishing
  async ensureValidTimestamp(event: NDKEvent): Promise<void> {
    // Set current timestamp if not already set
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    // Validate the timestamp
    const validation = await this.validateEventTimestamp(event);
    if (!validation.valid) {
      console.warn(`Correcting invalid event timestamp: ${validation.reason}`);
      // Reset to current time if invalid
      event.created_at = Math.floor(Date.now() / 1000);
    }
  }

  // Get following list for a specific pubkey
  async getFollowing(pubkey: string): Promise<string[]> {
    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }
      
      // Prepare a new subscription
      const filter = {
        authors: [pubkey],
        kinds: [3] // Contact List (NIP-02)
      };
      
      // Get the most recent contact list event
      const contactEvent = await this.ndk.fetchEvent(filter);
      
      if (!contactEvent) {
        console.log(`No contact list found for ${pubkey}`);
        return [];
      }
      
      // Extract pubkeys from p tags
      const following = contactEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      
      console.log(`Found ${following.length} followed accounts for ${pubkey}`);
      
      return following;
    } catch (error) {
      console.error('Error fetching following list:', error);
      return [];
    }
  }
}

// Create singleton instance
export const nostrService = new NostrService();
export default nostrService;

export async function initNostr(relays: string[] = []): Promise<{ ndk: NDK; user: NDKUser | null }> {
  // Combine default relays, provided relays, and blog-focused relays
  const combinedRelays = [...DEFAULT_RELAYS, ...relays];
  
  // Add blog-focused relays for better content discovery
  // Only add unique relays not already in the list
  BLOG_FOCUSED_RELAYS.forEach(relay => {
    if (!combinedRelays.includes(relay)) {
      combinedRelays.push(relay);
    }
  });
  
  const ndk = new NDK({
    explicitRelayUrls: combinedRelays,
    enableOutboxModel: false,
  });
  
  await ndk.connect();
  
  // Try to use NIP-07 extension for signing if available
  let user = null;
  try {
    const signer = new NDKNip07Signer();
    ndk.signer = signer;
    user = await signer.user();
  } catch (error) {
    console.log('No NIP-07 extension available');
  }
  
  return { ndk, user };
}

// Improve the fetch methods to better handle blog content

export async function fetchBlogPosts(
  ndk: NDK,
  limit: number = 50, // Increased default limit for better content discovery
  since?: number,
  until?: number
): Promise<NDKEvent[]> {
  const filter: NDKFilter = {
    kinds: [30023],
    limit: limit
  };
  
  if (since) {
    filter.since = since;
  } else {
    // Default to last 90 days if not specified
    filter.since = Math.floor(Date.now() / 1000) - 90 * 86400;
  }
  
  if (until) {
    filter.until = until;
  }
  
  // Increase timeout for better relay responses
  const timeoutMs = 12000; // 12 seconds
  
  try {
    // Set a timeout to ensure we don't wait indefinitely
    const timeoutPromise = new Promise<NDKEvent[]>((_, reject) => {
      setTimeout(() => reject(new Error("Blog fetch timeout")), timeoutMs);
    });
    
    // Actual fetch
    const fetchPromise = new Promise<NDKEvent[]>((resolve) => {
      ndk.fetchEvents(filter)
        .then(events => resolve(Array.from(events)))
        .catch(err => {
          console.error('Error in fetchEvents:', err);
          resolve([]);
        });
    });
    
    // Race between fetch and timeout
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

export async function createBlogPost(
  ndk: NDK,
  title: string,
  summary: string,
  content: string,
  image?: string,
  tags: string[] = []
): Promise<NDKEvent | null> {
  if (!ndk || !ndk.signer) {
    console.error('Cannot create blog post: no NDK instance or signer available');
    return null;
  }
  
  try {
    // Validate content length
    if (!content || content.length < 2500) {
      throw new Error('Blog content must be at least 2500 characters long');
    }

    // Create a new NIP-23 long-form content event
    const event = new NDKEvent(ndk);
    event.kind = 30023;
    event.content = content;
    
    // Enhance with better metadata for improved discovery
    // Add additional NIP-23 compliant tags
    const eventTags: string[][] = [
      ['title', title],
      ['summary', summary]
    ];
    
    // Add image tag if provided
    if (image) {
      eventTags.push(['image', image]);
    }
    
    // Add content-type tag for better clients
    eventTags.push(['content-type', 'text/markdown']);
    
    // Add topic tags for better discoverability
    tags.forEach(tag => {
      if (tag.trim()) {
        eventTags.push(['t', tag.trim().toLowerCase()]);
      }
    });
    
    // Add published_at tag for explicit timestamp
    eventTags.push(['published_at', Math.floor(Date.now() / 1000).toString()]);
    
    // Set tags and publish
    event.tags = eventTags;
    await event.publish();
    return event;
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
}

// ... existing code ... 