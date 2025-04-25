import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { Profile } from '../db';
import { EmbeddedNote } from './EmbeddedNote';
import { 
  RepostIcon, 
  ReplyIcon, 
  LikeIcon, 
  ShareIcon 
} from './ActionIcons';
import { Note } from './Note';

interface RepostNoteProps {
  event: NDKEvent;
}

export function RepostNote({ event }: RepostNoteProps) {
  const navigate = useNavigate();
  const { fetchProfile, verifyNip05, encodePublicKey, createReaction, currentUser, ndk } = useNostrContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [npub, setNpub] = useState<string>('');
  const [repostedNoteId, setRepostedNoteId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<NDKEvent[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Extract the reposted note ID from tags
  useEffect(() => {
    // Look for the 'e' tag which references the original post
    const eTag = event.tags.find(tag => tag[0] === 'e');
    if (eTag && eTag.length > 1) {
      setRepostedNoteId(eTag[1]);
    }
  }, [event]);

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

  // Function to handle like reaction
  const handleLike = async () => {
    if (!currentUser) {
      alert('Please login to like posts');
      return;
    }

    try {
      await createReaction(event.id, '+');
    } catch (error) {
      console.error('Failed to create reaction:', error);
    }
  };

  // Function to handle reply
  const handleReply = () => {
    toggleComments();
  };

  return (
    <div className="note-card repost-card">
      <div className="repost-header">
        <RepostIcon size={14} />
        <span>{profile?.displayName || profile?.name || 'Someone'} reposted</span>
      </div>
      
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
      
      {/* If there's a comment on the repost, show it */}
      {event.content && event.content.trim() !== '' && (
        <div className="note-content repost-comment">
          {event.content}
        </div>
      )}
      
      {/* Embedded original note */}
      {repostedNoteId && (
        <div className="reposted-content">
          <EmbeddedNote noteId={repostedNoteId} />
        </div>
      )}
      
      <div className="note-actions">
        <button 
          className="action-button" 
          onClick={handleReply}
          title="Reply"
        >
          <ReplyIcon />
        </button>
        <button 
          className="action-button" 
          onClick={handleLike}
          title="Like"
        >
          <LikeIcon />
        </button>
        <button 
          className="action-button" 
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/snailsfeed`)}
          title="Share"
        >
          <ShareIcon />
        </button>
      </div>
      
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