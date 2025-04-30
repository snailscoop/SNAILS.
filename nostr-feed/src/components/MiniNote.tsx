import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { Profile } from '../db';

// Import icons
const LikeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const FilledHeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#e74c3c" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const RepostIcon = ({ className = "" }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>
);

const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

interface MiniNoteProps {
  event: NDKEvent;
}

export function MiniNote({ event }: MiniNoteProps) {
  const navigate = useNavigate();
  const { fetchProfile, verifyNip05, encodePublicKey, createReaction, currentUser, ndk } = useNostrContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [npub, setNpub] = useState<string>('');
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);

  // Format time ago
  useEffect(() => {
    if (event.created_at) {
      const now = Math.floor(Date.now() / 1000);
      const diff = now - event.created_at;
      
      if (diff < 60) {
        setTimeAgo(`${diff}s`);
      } else if (diff < 3600) {
        setTimeAgo(`${Math.floor(diff / 60)}m`);
      } else if (diff < 86400) {
        setTimeAgo(`${Math.floor(diff / 3600)}h`);
      } else {
        setTimeAgo(`${Math.floor(diff / 86400)}d`);
      }
    }
  }, [event.created_at]);

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (event.pubkey) {
        // Get the npub for the profile link
        const encodedPubkey = encodePublicKey(event.pubkey);
        setNpub(encodedPubkey);
        
        const profileData = await fetchProfile(event.pubkey);
        setProfile(profileData);
      }
    };

    loadProfile();
  }, [event.pubkey, fetchProfile, encodePublicKey]);

  const handleProfileClick = () => {
    if (npub) {
      navigate(`/profile/${npub}`);
    }
  };

  const handleNoteClick = () => {
    if (npub) {
      navigate(`/profile/${npub}`, { state: { selectedNoteId: event.id } });
    }
  };

  const handleReaction = async (reaction: string) => {
    if (!currentUser) {
      alert('Please login to react to posts');
      return;
    }

    try {
      if (reaction === '+') {
        setLiked(true);
      }
      
      await createReaction(event.id, reaction);
    } catch (error) {
      console.error('Failed to create reaction:', error);
      if (reaction === '+') {
        setLiked(false);
      }
    }
  };

  // Handle repost
  const handleRepost = async () => {
    if (!currentUser) {
      alert('Please login to repost');
      return;
    }

    try {
      // Create a new event with kind 6 (repost)
      const repostEvent = new NDKEvent(ndk);
      repostEvent.kind = 6; // Kind 6 is for reposts
      repostEvent.tags = [
        ['e', event.id, '', 'mention'], // Reference to the original note
        ['p', event.pubkey] // Reference to the author of the original note
      ];
      repostEvent.content = ''; // Empty content for a pure repost

      // Sign and publish the event
      await repostEvent.publish();
      setReposted(true);
    } catch (error) {
      console.error('Failed to repost:', error);
    }
  };

  // Send zap
  const handleZap = async () => {
    if (!currentUser) {
      alert('Please login to send zaps');
      return;
    }
    
    alert('Zap functionality would be implemented here');
  };

  return (
    <div className="mini-note-card">
      <div className="mini-note-header">
        <div 
          className="mini-avatar"
          onClick={handleProfileClick}
        >
          {profile?.picture ? (
            <img src={profile.picture} alt={profile.name || 'User'} />
          ) : (
            <div className="mini-default-avatar"></div>
          )}
        </div>
        <div className="mini-user-info">
          <span className="mini-display-name" onClick={handleProfileClick}>
            {profile?.displayName || profile?.name || 'Anonymous'}
          </span>
          <span className="mini-time">{timeAgo}</span>
        </div>
      </div>
      
      <div className="mini-note-content" onClick={handleNoteClick}>
        {event.content && event.content.length > 150 
          ? `${event.content.substring(0, 150)}...` 
          : event.content || 'Empty note'}
      </div>
      
      <div className="mini-note-actions">
        <button
          className="mini-action-button"
          onClick={() => handleReaction('+')}
          title={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <FilledHeartIcon /> : <LikeIcon />}
        </button>
        <button
          className="mini-action-button"
          onClick={handleRepost}
          title={reposted ? "Reposted" : "Repost"}
        >
          <RepostIcon className={reposted ? "reposted" : ""} />
        </button>
        <button 
          className="mini-action-button" 
          onClick={handleZap}
          title="Zap"
        >
          <ZapIcon />
        </button>
      </div>
    </div>
  );
} 