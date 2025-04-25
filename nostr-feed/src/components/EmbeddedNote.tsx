import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { EnhancedContent } from './ContentEmbeds';
import { Profile } from '../db';

// Helper to clean up note IDs in various formats
function cleanNoteId(noteId?: string): string | undefined {
  if (!noteId) return undefined;
  
  // Remove any prefix like "note1" or "event1" if present
  if (noteId.startsWith('note1') || noteId.startsWith('event1')) {
    return noteId.substring(5);
  }
  
  // Handle nevent format
  if (noteId.startsWith('nevent:1')) {
    return noteId.substring(8);
  }
  
  // Handle displayed raw nostr:nevent format
  if (noteId.startsWith('nostr:nevent1')) {
    return noteId.substring(13);
  }
  
  // Handle nostr:note1 and nostr:event1 formats
  if (noteId.startsWith('nostr:note1')) {
    return noteId.substring(11);
  }
  if (noteId.startsWith('nostr:event1')) {
    return noteId.substring(12);
  }
  
  return noteId;
}

interface EmbeddedNoteProps {
  noteId?: string;
}

export function EmbeddedNote({ noteId }: EmbeddedNoteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<NDKEvent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const { fetchEvent, fetchProfile, encodePublicKey } = useNostrContext();

  useEffect(() => {
    const loadEvent = async () => {
      const cleanedId = cleanNoteId(noteId);
      
      if (!cleanedId) {
        setError('Invalid note ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch the referenced event
        const eventData = await fetchEvent(cleanedId);
        if (!eventData) {
          setError('Note not found');
          setLoading(false);
          return;
        }

        setEvent(eventData);

        // Fetch author profile
        if (eventData.pubkey) {
          const authorProfile = await fetchProfile(eventData.pubkey);
          setProfile(authorProfile);
        }

        // Format time ago
        if (eventData.created_at) {
          const now = Math.floor(Date.now() / 1000);
          const diff = now - eventData.created_at;
          
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

        setLoading(false);
      } catch (err) {
        console.error('Error loading embedded note:', err);
        setError('Failed to load note');
        setLoading(false);
      }
    };

    loadEvent();
  }, [noteId, fetchEvent, fetchProfile]);

  const handleProfileClick = () => {
    if (event && profile) {
      const npub = encodePublicKey(event.pubkey);
      navigate(`/profile/${npub}`);
    }
  };

  const handleNoteClick = () => {
    // Remove navigation to note page
    // Just show the note details in the current view
  };

  if (loading) {
    return (
      <div className="embedded-note-loading">
        Loading embedded note...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="embedded-note-error">
        {error || 'Failed to load embedded note'}
      </div>
    );
  }

  return (
    <div className="embedded-note" onClick={handleNoteClick}>
      <div className="embedded-note-header">
        <div 
          className="embedded-avatar"
          onClick={(e) => {
            e.stopPropagation();
            handleProfileClick();
          }}
        >
          {profile?.picture ? (
            <img src={profile.picture} alt={profile.name || 'User'} />
          ) : (
            <div className="embedded-default-avatar"></div>
          )}
        </div>
        <div className="embedded-user-info">
          <span 
            className="embedded-display-name"
            onClick={(e) => {
              e.stopPropagation();
              handleProfileClick();
            }}
          >
            {profile?.displayName || profile?.name || 'Anonymous'}
          </span>
          <span className="embedded-timestamp">{timeAgo}</span>
        </div>
      </div>
      <div className="embedded-note-content">
        <EnhancedContent content={event.content} />
      </div>
    </div>
  );
} 