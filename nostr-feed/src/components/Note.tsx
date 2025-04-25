import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { Profile } from '../db';
import { EnhancedContent } from './ContentEmbeds';
import { 
  RepostIcon, 
  ReplyIcon, 
  LikeIcon, 
  FilledHeartIcon, 
  ZapIcon, 
  ShareIcon 
} from './ActionIcons';

interface NoteProps {
  event: NDKEvent;
  showActions?: boolean;
  embedded?: boolean;
}

export function Note({ event, showActions = true, embedded = false }: NoteProps) {
  const navigate = useNavigate();
  const { fetchProfile, verifyNip05, encodePublicKey, createReaction, createZapRequest, currentUser, ndk } = useNostrContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [npub, setNpub] = useState<string>('');
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [showZapMenu, setShowZapMenu] = useState(false);
  const [zapAmount, setZapAmount] = useState(0);
  const [zapMessage, setZapMessage] = useState('');
  const [isZapping, setIsZapping] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<NDKEvent[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

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
        
        // Check NIP-05 verification if available
        if (profileData?.nip05) {
          const isVerified = await verifyNip05(event.pubkey, profileData.nip05);
          setVerified(isVerified);
        }
      }
    };

    loadProfile();
  }, [event.pubkey, fetchProfile, verifyNip05, encodePublicKey]);

  // Load comments for this note
  const loadComments = useCallback(async () => {
    if (!event.id || !ndk) return;

    try {
      setIsLoadingComments(true);
      // Query for kind 1 events (text notes) that reference this note
      const filter = {
        kinds: [1],
        '#e': [event.id],
      };
      
      const commentEvents = await ndk.fetchEvents(filter);
      const sortedComments = Array.from(commentEvents).sort((a, b) => {
        return (b.created_at || 0) - (a.created_at || 0);
      });
      
      setComments(sortedComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [event.id, ndk]);

  // When comments are shown, load them
  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, event.id, loadComments]);

  // Handle posting a comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !ndk) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      
      // Create a new comment event
      const commentEvent = new NDKEvent(ndk);
      commentEvent.kind = 1; // Kind 1 is text note
      commentEvent.content = commentText;
      commentEvent.tags = [
        ['e', event.id, '', 'reply'], // Reference to the parent note
        ['p', event.pubkey] // Reference to the author of the parent note
      ];
      
      // Sign and publish
      await commentEvent.publish();
      
      // Reset form and reload comments
      setCommentText('');
      loadComments();
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const handleProfileClick = () => {
    if (npub) {
      navigate(`/profile/${npub}`);
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

  const toggleZapMenu = () => {
    if (!currentUser) {
      alert('Please login to send zaps');
      return;
    }
    setShowZapMenu(!showZapMenu);
  };

  const handleZapAmountSelect = (amount: number) => {
    setZapAmount(amount);
  };

  const handleZapSubmit = async () => {
    if (!currentUser || !profile) {
      alert('Please login to send zaps');
      return;
    }

    try {
      setIsZapping(true);
      
      // Create zap request
      const zapRequest = await createZapRequest(
        event.id,
        event.pubkey,
        zapAmount,
        zapMessage
      );
      
      if (!zapRequest) {
        throw new Error('Failed to create zap request');
      }
      
      // In a real app, we would now use this to make an LNURL payment
      // For now, just show a success message
      alert(`Zap request created for ${zapAmount} sats!`);
      
      // Reset form
      setZapAmount(0);
      setZapMessage('');
      setShowZapMenu(false);
    } catch (error) {
      console.error('Failed to send zap:', error);
      alert('Failed to send zap');
    } finally {
      setIsZapping(false);
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
      repostEvent.content = ''; // Empty content for a pure repost, or could add a comment

      // Sign and publish the event
      await repostEvent.publish();
      setReposted(true);
    } catch (error) {
      console.error('Failed to repost:', error);
    }
  };

  const actions = showActions && (
    <div className="note-actions">
      {!embedded && (
        <button
          className="action-button"
          onClick={toggleComments}
          title="Reply"
        >
          <ReplyIcon />
        </button>
      )}
      {!embedded && (
        <button
          className="action-button"
          onClick={handleRepost}
          title={reposted ? "Reposted" : "Repost"}
        >
          <RepostIcon className={reposted ? "reposted" : ""} />
        </button>
      )}
      <button
        className="action-button"
        onClick={() => handleReaction('+')}
        title={liked ? 'Unlike' : 'Like'}
      >
        {liked ? <FilledHeartIcon /> : <LikeIcon />}
      </button>
      <div className="zap-container">
        <button 
          className="action-button" 
          onClick={toggleZapMenu}
          title="Zap"
        >
          <ZapIcon />
        </button>
        
        {showZapMenu && (
          <div className="zap-menu">
            <div className="zap-amounts">
              <button 
                className={`zap-amount-button ${zapAmount === 5 ? 'selected' : ''}`}
                onClick={() => handleZapAmountSelect(5)}
              >
                5 sats
              </button>
              <button 
                className={`zap-amount-button ${zapAmount === 10 ? 'selected' : ''}`}
                onClick={() => handleZapAmountSelect(10)}
              >
                10 sats
              </button>
              <button 
                className={`zap-amount-button ${zapAmount === 50 ? 'selected' : ''}`}
                onClick={() => handleZapAmountSelect(50)}
              >
                50 sats
              </button>
              <button 
                className={`zap-amount-button ${zapAmount === 100 ? 'selected' : ''}`}
                onClick={() => handleZapAmountSelect(100)}
              >
                100 sats
              </button>
              <button 
                className={`zap-amount-button ${zapAmount === 1000 ? 'selected' : ''}`}
                onClick={() => handleZapAmountSelect(1000)}
              >
                1000 sats
              </button>
            </div>
            <textarea
              className="zap-message"
              placeholder="Add a message (optional)"
              value={zapMessage}
              onChange={(e) => setZapMessage(e.target.value)}
            />
            <div className="zap-actions">
              <button 
                className="zap-cancel"
                onClick={() => setShowZapMenu(false)}
              >
                Cancel
              </button>
              <button 
                className="zap-submit"
                onClick={handleZapSubmit}
                disabled={!zapAmount || isZapping}
              >
                {isZapping ? 'Zapping...' : 'Send Zap'}
              </button>
            </div>
          </div>
        )}
      </div>
      <button className="action-button" title="Share">
        <ShareIcon />
      </button>
    </div>
  );

  return (
    <div className="note-card">
      <div className="note-header">
        <div 
          className="avatar-link" 
          onClick={handleProfileClick}
          style={{ cursor: 'pointer' }}
        >
          <div className="avatar">
            {profile?.picture ? (
              <img src={profile.picture} alt={profile.name || 'User'} />
            ) : (
              <div className="default-avatar"></div>
            )}
          </div>
        </div>
        <div className="user-info">
          <div className="name-container">
            <div 
              className="display-name-link" 
              onClick={handleProfileClick}
              style={{ cursor: 'pointer' }}
            >
              <span className="display-name">{profile?.displayName || profile?.name || 'Anonymous'}</span>
            </div>
            {verified && <span className="verified-badge">✓</span>}
          </div>
          <div 
            className="username-link" 
            onClick={handleProfileClick}
            style={{ cursor: 'pointer' }}
          >
            <span className="username">@{profile?.name || event.pubkey.slice(0, 10)}</span>
          </div>
        </div>
        <div className="timestamp">{timeAgo}</div>
      </div>
      
      <div className="note-content">
        <EnhancedContent content={event.content} />
      </div>
      
      {actions}
      
      {showComments && (
        <div className="comments-section">
          <form onSubmit={handlePostComment} className="comment-form">
            <textarea
              className="comment-input"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isSubmittingComment}
            />
            <button 
              type="submit" 
              className="post-comment-button"
              disabled={!commentText.trim() || isSubmittingComment}
            >
              {isSubmittingComment ? 'Posting...' : 'Post'}
            </button>
          </form>
          
          <div className="comments-list">
            <h4>Comments</h4>
            {isLoadingComments ? (
              <div className="loading-comments">Loading comments...</div>
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <Note event={comment} embedded={true} />
                </div>
              ))
            ) : (
              <div className="no-comments">No comments yet. Be the first to comment!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 