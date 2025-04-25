import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { FiBell } from 'react-icons/fi';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Interface for our notification types
interface NostrNotification {
  id: string;
  type: 'mention' | 'reaction' | 'repost' | 'reply';
  pubkey: string;
  createdAt: number;
  content: string;
  eventId?: string; // Reference to the original event
  relatedEventId?: string; // Event this notification is about
  seen: boolean;
}

export function NotificationBell() {
  const { currentUser, ndk, subscribeToNotes, fetchProfile } = useNostrContext();
  const [notifications, setNotifications] = useState<NostrNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; picture?: string }>>({});
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Toggle notification panel visibility
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      // Mark all as read when opening the panel
      markAllAsRead();
    }
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
    setHasUnread(false);
  };

  // Format notification time
  const formatTime = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Load user profile data
  const loadUserProfile = useCallback(async (pubkey: string) => {
    if (userProfiles[pubkey]) return;
    
    try {
      const profile = await fetchProfile(pubkey);
      if (profile) {
        setUserProfiles(prev => ({
          ...prev,
          [pubkey]: {
            name: profile.name || profile.displayName || 'anonymous',
            picture: profile.picture || undefined
          }
        }));
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [userProfiles, fetchProfile]);

  // Handle new notification events
  const handleNotificationEvent = useCallback(async (event: NDKEvent) => {
    if (!currentUser) return;
    
    // Helper to check if an event relates to the current user
    const isUserRelatedEvent = async (event: NDKEvent) => {
      if (!currentUser) return false;
      
      // For replies and mentions, we need to check the event content and tags
      if (event.kind === 1) {
        // Check for mentions in tags
        const isMentioned = event.tags.some(tag => 
          tag[0] === 'p' && tag[1] === currentUser.pubkey
        );
        
        if (isMentioned) return true;
        
        // Check for mentions in content (this is simplistic, consider more robust parsing)
        const npub = nip19.npubEncode(currentUser.pubkey);
        if (event.content.includes(npub)) return true;
      }
      
      // For reactions and reposts, we need to check if the referenced event is ours
      if (event.kind === 6 || event.kind === 7) {
        const eventRefs = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
        
        if (eventRefs.length === 0) return false;
        
        // Now we need to fetch each referenced event to see if it's by the current user
        for (const eventId of eventRefs) {
          try {
            const filter: NDKFilter = { ids: [eventId] };
            const events = await ndk.fetchEvents(filter);
            
            for (const referencedEvent of events) {
              if (referencedEvent.pubkey === currentUser.pubkey) {
                return true;
              }
            }
          } catch (error) {
            console.error('Error checking referenced event:', error);
          }
        }
      }
      
      return false;
    };
    
    // First verify this event is actually related to the current user
    // Skip processing if it's not related to avoid false notifications
    const isRelated = await isUserRelatedEvent(event);
    if (!isRelated) return;
    
    let notificationType: 'mention' | 'reaction' | 'repost' | 'reply' | null = null;
    let content = '';
    let relatedEventId: string | undefined;
    
    // Kind 1: Text note (check for mentions or replies)
    if (event.kind === 1) {
      // Check if it's a mention
      const mentionTags = event.tags.filter(tag => 
        tag[0] === 'p' && tag[1] === currentUser.pubkey
      );
      
      if (mentionTags.length > 0) {
        notificationType = 'mention';
        content = 'mentioned you in a note';
      }
      
      // Check if it's a reply to your note
      const replyTags = event.tags.filter(tag => 
        tag[0] === 'e' && tag[3] === 'reply'
      );
      
      if (replyTags.length > 0) {
        // We already verified it's a reply to one of our notes above
        notificationType = 'reply';
        content = 'replied to your note';
        relatedEventId = replyTags[0][1]; // Store the event ID that was replied to
      }
    }
    
    // Kind 7: Reaction
    else if (event.kind === 7) {
      const reactedToTags = event.tags.filter(tag => 
        tag[0] === 'e'
      );
      
      if (reactedToTags.length > 0) {
        notificationType = 'reaction';
        content = event.content === '+' ? 'liked your note' : `reacted to your note with "${event.content}"`;
        relatedEventId = reactedToTags[0][1];
      }
    }
    
    // Kind 6: Repost
    else if (event.kind === 6) {
      const repostTags = event.tags.filter(tag => 
        tag[0] === 'e'
      );
      
      if (repostTags.length > 0) {
        notificationType = 'repost';
        content = 'reposted your note';
        relatedEventId = repostTags[0][1];
      }
    }
    
    // If we identified a notification type, add it to our list
    if (notificationType) {
      const newNotification: NostrNotification = {
        id: event.id,
        type: notificationType,
        pubkey: event.pubkey,
        createdAt: event.created_at ?? Math.floor(Date.now() / 1000),
        content,
        eventId: event.id,
        relatedEventId,
        seen: false
      };
      
      setNotifications(prev => {
        // Avoid duplicates
        if (prev.some(n => n.id === newNotification.id)) {
          return prev;
        }
        return [newNotification, ...prev].sort((a, b) => b.createdAt - a.createdAt);
      });
      
      // Set unread flag
      setHasUnread(true);
      
      // Load profile for this pubkey
      loadUserProfile(event.pubkey);
    }
  }, [currentUser, ndk, loadUserProfile]);

  // Subscribe to notifications
  useEffect(() => {
    let subscription: ReturnType<typeof ndk.subscribe> | null = null;
    
    const setupNotifications = async () => {
      if (!currentUser) return;
      
      try {
        // Only get events from last 2 days instead of 7 to reduce initial load
        const sinceTime = Math.floor(Date.now() / 1000) - (2 * 86400);
        
        // Use focused subscriptions instead of one broad subscription
        
        // 1. Subscribe to mentions of the current user
        const mentionFilter: NDKFilter = {
          '#p': [currentUser.pubkey],
          kinds: [1], // text notes
          since: sinceTime,
          limit: 20
        };
        
        const mentionEvents = await ndk.fetchEvents(mentionFilter);
        for (const event of mentionEvents) {
          await handleNotificationEvent(event);
        }
        
        // 2. Get user's posts to check for reactions
        const userPostsFilter: NDKFilter = {
          authors: [currentUser.pubkey],
          kinds: [1],
          limit: 30
        };
        
        const userPosts = await ndk.fetchEvents(userPostsFilter);
        const userPostIds: string[] = [];
        userPosts.forEach(event => {
          if (event.id) userPostIds.push(event.id);
        });
        
        if (userPostIds.length > 0) {
          // 3. Check for reactions to the user's posts
          const reactionsFilter: NDKFilter = {
            '#e': userPostIds,
            kinds: [6, 7], // reposts, reactions
            since: sinceTime,
            limit: 30
          };
          
          const reactionEvents = await ndk.fetchEvents(reactionsFilter);
          for (const event of reactionEvents) {
            await handleNotificationEvent(event);
          }
        }
        
        // 4. Set up ongoing subscription for new mentions and reactions
        // This subscription will catch new notifications as they happen
        
        // Add mentions filter separately - use pubkeys parameter properly
        subscription = await subscribeToNotes(
          undefined, // No specific pubkeys filter
          30, 
          handleNotificationEvent
        );

      } catch (error) {
        console.error('Failed to set up notifications:', error);
      }
    };
    
    setupNotifications();
    
    return () => {
      if (subscription) {
        subscription.stop();
      }
    };
  }, [currentUser, ndk, subscribeToNotes, handleNotificationEvent]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // If user is not logged in, don't show the notification bell
  if (!currentUser) return null;
  
  // Get display name for a pubkey
  const getDisplayName = (pubkey: string) => {
    const profile = userProfiles[pubkey];
    return profile?.name || pubkey.slice(0, 8);
  };
  
  return (
    <div className="notification-container" ref={notificationRef}>
      <button 
        className={`notification-bell ${hasUnread ? 'has-unread' : ''}`}
        onClick={toggleNotifications}
        aria-label="Notifications"
      >
        <FiBell size={20} />
        {hasUnread && <span className="notification-badge"></span>}
      </button>
      
      {showNotifications && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            <button 
              className="mark-all-read"
              onClick={markAllAsRead}
            >
              Mark all as read
            </button>
          </div>
          
          <ul className="notification-list">
            {notifications.length === 0 ? (
              <li className="notification-item empty-notifications">
                <div className="notification-content">
                  <span className="notification-text">No notifications yet</span>
                </div>
              </li>
            ) : (
              notifications.map((notification) => (
                <li key={notification.id} className={`notification-item ${!notification.seen ? 'unread' : ''}`}>
                  <div className="notification-avatar">
                    {userProfiles[notification.pubkey]?.picture ? (
                      <img 
                        src={userProfiles[notification.pubkey].picture} 
                        alt={getDisplayName(notification.pubkey)} 
                      />
                    ) : (
                      <div className="default-avatar tiny"></div>
                    )}
                  </div>
                  <div className="notification-content">
                    <span className="notification-user">@{getDisplayName(notification.pubkey)}</span>
                    <span className="notification-text">{notification.content}</span>
                    <span className="notification-time">{formatTime(notification.createdAt)}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
          
          <div className="notification-footer">
            <button className="see-all-button">See all notifications</button>
          </div>
        </div>
      )}
    </div>
  );
} 