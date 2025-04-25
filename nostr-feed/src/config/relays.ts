// Default relays for general Nostr communication
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
  'wss://nostr.mutinywallet.com',
  'wss://relay.zaps.stream',    // Specialized for livestreaming
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.nostr.bg',       // Additional relay for better discovery
  'wss://nostr.oxtr.dev',       // Fast relay
  'wss://nostr.fmt.wiz.biz',    // High performance relay
  'wss://eden.nostr.land',      // Premium relay with good uptime
  'wss://relay.nostr.info',     // Reliable general purpose relay
  'wss://nostr.zebedee.cloud'   // Well-maintained relay with good uptime
];

// Relays focused on blog content (NIP-23)
export const BLOG_FOCUSED_RELAYS = [
  'wss://relay.nostr.band',        // Known for indexing long-form content
  'wss://relay.snort.social',      // High-quality content relay
  'wss://nos.lol',                 // Popular general relay with good blog content
  'wss://relay.damus.io',          // Popular relay with many writers
  'wss://relay.current.fyi',       // Content-focused relay
  'wss://nostr.mutinywallet.com',  // Quality relay with good uptime
  'wss://nostr.oxtr.dev',          // Fast relay good for blog content
  'wss://nostr.wine'               // Good for discovering diverse content
]; 