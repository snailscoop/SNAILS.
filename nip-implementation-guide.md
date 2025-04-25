# Implementation Guide for Essential NIPs in a Nostr Client

This guide covers how to implement the following NIPs (Nostr Implementation Possibilities) in your Nostr client:

- NIP-01: Basic protocol flow description
- NIP-11: Relay Information Document
- NIP-20: Command Results
- NIP-22: Event `created_at` Limits
- NIP-16: Event Treatment

## NIP-01: Basic Protocol Flow Description

NIP-01 is the foundation of Nostr. It defines the core event format and communication with relays.

### Implementation Steps:

1. **Set up WebSocket connections to relays**:
   ```javascript
   // Initialize NDK with default relays
   this.ndk = new NDK({
     explicitRelayUrls: [
       'wss://relay.damus.io',
       'wss://relay.nostr.band',
       'wss://relay.snort.social',
       // Add more relays
     ],
     autoConnectUserRelays: true,
     enableOutboxModel: true
   });
   
   // Connect to relays
   await this.ndk.connect();
   ```

2. **Create event objects** (follow the standard format):
   ```javascript
   // Creating a basic note (kind 1) event
   const event = new NDKEvent(this.ndk);
   event.kind = 1; // Text note
   event.content = "Hello, Nostr!";
   event.created_at = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
   
   // Add tags as needed (NIP-10 conventions)
   if (replyTo) {
     event.tags.push(['e', replyTo, '', 'reply']);
   }
   
   // Sign the event
   await event.sign();
   
   // Publish to relays
   await event.publish();
   ```

3. **Subscribe to events**:
   ```javascript
   // Create a filter
   const filter = {
     kinds: [1], // Text notes
     limit: 100,
     authors: ['pubkey1', 'pubkey2'], // Optional
     since: Math.floor(Date.now() / 1000) - (24 * 60 * 60) // Last 24 hours
   };
   
   // Subscribe to events matching this filter
   const subscription = await this.ndk.subscribe(filter, {
     closeOnEose: false // Keep subscription open
   });
   
   // Handle incoming events
   subscription.on('event', (event) => {
     // Process new events
     console.log('Received event:', event);
   });
   ```

4. **Handle cryptographic operations**:
   ```javascript
   // Event signing (handled by NDK in previous examples)
   
   // For encryption (NIP-04), example of direct message:
   const encryptedContent = await nip04.encrypt(
     secretKey,
     recipientPubkey,
     message
   );
   
   // For decryption:
   const decryptedContent = await nip04.decrypt(
     secretKey,
     senderPubkey,
     encryptedMessage
   );
   ```

## NIP-11: Relay Information Document

NIP-11 allows clients to query relays for metadata about their capabilities.

### Implementation Steps:

1. **Query relay metadata**:
   ```javascript
   async function getRelayInfo(relayUrl) {
     try {
       // Remove WebSocket protocol and add https
       const infoUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');
       
       // Make HTTP request to get NIP-11 information
       const response = await fetch(infoUrl, {
         headers: {
           'Accept': 'application/nostr+json'
         }
       });
       
       if (!response.ok) {
         throw new Error(`Failed to fetch relay info: ${response.status}`);
       }
       
       const relayInfo = await response.json();
       return relayInfo;
     } catch (error) {
       console.error(`Error fetching relay info from ${relayUrl}:`, error);
       return null;
     }
   }
   ```

2. **Use relay information in your client**:
   ```javascript
   // Cache relay information
   const relayInfoCache = new Map();
   
   // Get relay capabilities
   async function getRelaySupportedNIPs(relayUrl) {
     // Check cache first
     if (relayInfoCache.has(relayUrl)) {
       return relayInfoCache.get(relayUrl).supported_nips || [];
     }
     
     const info = await getRelayInfo(relayUrl);
     if (info) {
       relayInfoCache.set(relayUrl, info);
       return info.supported_nips || [];
     }
     
     return [];
   }
   
   // Example: Check if a relay supports a specific NIP
   async function relaySupportsNIP(relayUrl, nipNumber) {
     const supportedNIPs = await getRelaySupportedNIPs(relayUrl);
     return supportedNIPs.includes(nipNumber);
   }
   
   // Example: Filter relays that support a specific feature
   async function getRelaysSupporting(relayUrls, nipNumber) {
     const results = await Promise.all(
       relayUrls.map(async (url) => {
         const supports = await relaySupportsNIP(url, nipNumber);
         return { url, supports };
       })
     );
     
     return results
       .filter(result => result.supports)
       .map(result => result.url);
   }
   ```

## NIP-20: Command Results

NIP-20 defines standardized responses from relays for client commands.

### Implementation Steps:

1. **Handle relay responses**:
   ```javascript
   // When using a direct WebSocket connection
   function setupWebSocket(relayUrl) {
     const ws = new WebSocket(relayUrl);
     
     ws.onmessage = (event) => {
       const message = JSON.parse(event.data);
       
       // Handle NIP-20 command results
       if (message[0] === 'OK') {
         // Format: ["OK", <event_id>, <success_message>, <additional_info>]
         const eventId = message[1];
         const success = message[2];
         const info = message[3]; // Optional
         
         console.log(`Event ${eventId} processed with result: ${success}`);
         if (info) {
           console.log(`Additional info: ${info}`);
         }
         
         // Handle successful publishing
       } else if (message[0] === 'EVENT') {
         // Handle incoming events
       } else if (message[0] === 'NOTICE') {
         // Handle notices
         console.warn(`Notice from relay ${relayUrl}: ${message[1]}`);
       } else if (message[0] === 'EOSE') {
         // End of stored events
       } else if (message[0] === 'AUTH') {
         // Handle auth challenges (NIP-42)
       }
     };
     
     return ws;
   }
   ```

2. **Handle errors from relays**:
   ```javascript
   // With libraries like NDK, you might need to listen for specific events
   
   // Example with direct WebSocket:
   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     
     if (message[0] === 'OK' && message[2] === false) {
       console.error(`Failed to publish event ${message[1]}: ${message[3]}`);
       // Handle specific error cases
       if (message[3] && message[3].includes('rate-limited')) {
         // Handle rate limiting
       } else if (message[3] && message[3].includes('invalid')) {
         // Handle invalid event
       }
       // You might want to retry on other relays
     }
   };
   ```

## NIP-22: Event `created_at` Limits

NIP-22 specifies acceptable timestamp ranges for events to prevent relays from accepting events with invalid timestamps.

### Implementation Steps:

1. **Set proper created_at timestamp for all events**:
   ```javascript
   // Always use current time for created_at
   function createEvent(kind, content, tags = []) {
     const event = new NDKEvent(this.ndk);
     event.kind = kind;
     event.content = content;
     event.created_at = Math.floor(Date.now() / 1000); // Current Unix timestamp
     
     // Add tags
     tags.forEach(tag => event.tags.push(tag));
     
     return event;
   }
   ```

2. **Validate incoming events**:
   ```javascript
   // Helper function to validate created_at timestamps
   function isValidTimestamp(timestamp) {
     const now = Math.floor(Date.now() / 1000);
     
     // Typically relays reject events more than 60 minutes in the future
     // or older than some relay-specific limit
     const MAX_FUTURE_SECONDS = 60 * 60; // 1 hour
     const MAX_PAST_SECONDS = 60 * 60 * 24 * 365 * 5; // Example: 5 years
     
     return (
       timestamp <= now + MAX_FUTURE_SECONDS &&
       timestamp >= now - MAX_PAST_SECONDS
     );
   }
   
   // Use this when processing events
   function processEvent(event) {
     if (!isValidTimestamp(event.created_at)) {
       console.warn(`Event ${event.id} has invalid timestamp: ${event.created_at}`);
       // Maybe don't display this event or mark it as suspicious
       return false;
     }
     
     // Continue processing valid event
     return true;
   }
   ```

## NIP-16: Event Treatment

NIP-16 outlines how relays handle events, especially replaceable and ephemeral events.

### Implementation Steps:

1. **Handle replaceable events** (kinds 0, 3, etc.):
   ```javascript
   // Creating a profile metadata event (kind 0) - replaceable
   async function updateProfile(profileData) {
     // This will replace any previous kind 0 event from this user
     const event = createEvent(0, JSON.stringify(profileData));
     await event.sign();
     await event.publish();
   }
   
   // Creating a contact list (kind 3) - replaceable
   async function updateContacts(contacts) {
     const event = createEvent(3, "");
     
     // Add p tags for each contact
     contacts.forEach(pubkey => {
       event.tags.push(['p', pubkey]);
     });
     
     await event.sign();
     await event.publish();
   }
   ```

2. **Handle parameterized replaceable events** (kind 30000-39999 with d tag):
   ```javascript
   // Creating a parameterized replaceable event
   async function createCustomList(name, items) {
     const event = createEvent(30001, JSON.stringify(items));
     
     // The 'd' tag is what makes this parameterized replaceable
     // Events with same kind, pubkey and 'd' tag value replace each other
     event.tags.push(['d', name]);
     
     await event.sign();
     await event.publish();
   }
   ```

3. **Handle ephemeral events** (kind 20000-29999):
   ```javascript
   // Creating an ephemeral event (not stored long-term by relays)
   async function sendEphemeralEvent(content) {
     const event = createEvent(20001, content);
     
     // Ephemeral events can be deleted from relays more aggressively
     await event.sign();
     await event.publish();
     
     // No need to store locally, as relays won't keep it long-term
   }
   ```

4. **Handle regular events** (most other kinds):
   ```javascript
   // Regular events (like kind 1) are stored indefinitely by relays
   async function publishNote(content, replyTo = null) {
     const event = createEvent(1, content);
     
     if (replyTo) {
       event.tags.push(['e', replyTo, '', 'reply']);
     }
     
     await event.sign();
     await event.publish();
     
     // Store locally for faster retrieval
     await db.events.put({
       id: event.id,
       pubkey: event.pubkey,
       created_at: event.created_at,
       kind: event.kind,
       tags: event.tags,
       content: event.content,
       sig: event.sig
     });
   }
   ```

## Integration in a Client

To fully implement these NIPs in your client:

1. **Create a Nostr service class** that handles:
   - Relay connections and management
   - Event creation, signing, and publication
   - Subscription management
   - Event validation and processing

2. **Build UI components** that:
   - Display events appropriately based on their kinds
   - Handle replaceable events by showing only the latest version
   - Provide feedback about command results (NIP-20)
   - Show relay information and status (NIP-11)

3. **Implement robust error handling** to:
   - Detect and report relay errors
   - Validate events before displaying them
   - Handle failed publications gracefully

By implementing these core NIPs, your client will have a solid foundation to interact reliably with the Nostr network. 