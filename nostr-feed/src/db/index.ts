import Dexie from 'dexie';

// Define database schema
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface Profile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  banner?: string;
  metadata?: string;
  lastUpdated?: number;
}

export interface DirectMessage {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  content: string;
  encryptedContent: string;
  created_at: number;
}

export interface Reaction {
  id: string;
  pubkey: string;
  eventId: string;
  reaction: string;
  created_at: number;
}

export interface Contact {
  pubkey: string;
  contactPubkey: string;
  petname?: string;
  relay?: string;
  created_at: number;
}

export interface FileMetadata {
  id: string;
  pubkey: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  hash?: string;
  magnetURI?: string;
  torrentInfoHash?: string;
  dimensions?: string;
  blurhash?: string;
  created_at: number;
}

export interface List {
  id: string;
  pubkey: string;
  name: string;
  description: string;
  kind: number;
  created_at: number;
}

export interface ListItem {
  id: string;
  listId: string;
  itemId: string;
  itemType: 'event' | 'profile' | 'url';
  relatedPubkey?: string;
  url?: string;
}

class NostrDatabase extends Dexie {
  events!: Dexie.Table<NostrEvent, string>;
  profiles!: Dexie.Table<Profile, string>;
  directMessages!: Dexie.Table<DirectMessage, string>;
  reactions!: Dexie.Table<Reaction, string>;
  contacts!: Dexie.Table<Contact, string>;
  fileMetadata!: Dexie.Table<FileMetadata, string>;
  lists!: Dexie.Table<List, string>;
  listItems!: Dexie.Table<ListItem, string>;
  
  constructor() {
    super('NostrFeed');
    
    this.version(1).stores({
      events: 'id, pubkey, created_at, kind',
      profiles: 'pubkey, name, nip05'
    });

    // Upgrade to add tables for new NIPs
    this.version(2).stores({
      events: 'id, pubkey, created_at, kind',
      profiles: 'pubkey, name, nip05',
      directMessages: 'id, senderPubkey, recipientPubkey, created_at',
      reactions: 'id, pubkey, eventId, reaction, created_at',
      contacts: '[pubkey+contactPubkey], pubkey, contactPubkey, created_at',
      fileMetadata: 'id, pubkey, url, name, mimeType, created_at',
      lists: 'id, pubkey, name, kind, created_at',
      listItems: '[listId+itemId], listId, itemId, itemType'
    });
  }
}

export const db = new NostrDatabase(); 