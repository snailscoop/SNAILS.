export interface Nip23Event {
  id?: string;
  pubkey?: string;
  content?: string;
  title?: string;
  summary?: string;
  image?: string;
  tags?: string[];
  published_at?: number;
  created_at?: number;
} 