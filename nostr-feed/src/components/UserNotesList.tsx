import { useState, useEffect } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { useNavigate } from 'react-router-dom';
import { MiniNote } from './MiniNote';

interface UserNotesListProps {
  pubkey: string;
  limit?: number;
  className?: string;
}

export function UserNotesList({ pubkey, limit = 5, className = '' }: UserNotesListProps) {
  const { encodePublicKey, ndk } = useNostrContext();
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const npub = encodePublicKey(pubkey);

  useEffect(() => {
    const loadNotes = async () => {
      if (!pubkey || !ndk) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Create a filter to fetch notes (kind 1) from this pubkey
        const filter = {
          kinds: [1],
          authors: [pubkey],
          limit: limit,
        };
        
        // Fetch events once instead of subscribing
        const events = await ndk.fetchEvents(filter);
        
        // Convert events to array and sort by timestamp (newest first)
        const sortedNotes = Array.from(events).sort((a, b) => 
          (b.created_at || 0) - (a.created_at || 0)
        ).slice(0, limit);
        
        setNotes(sortedNotes);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch notes:', err);
        setError('Failed to load notes');
        setIsLoading(false);
      }
    };

    loadNotes();
  }, [pubkey, limit, ndk]);

  const navigateToProfile = () => {
    navigate(`/profile/${npub}`);
  };

  const viewAllButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    margin: '15px auto 0',
    padding: '8px 15px',
    background: 'rgba(74, 155, 255, 0.2)',
    border: '1px solid rgba(74, 155, 255, 0.4)',
    color: '#4a9bff',
    borderRadius: '20px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  if (isLoading) {
    return (
      <div className={`user-notes-loading ${className}`}>
        <div className="loading-spinner">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
        </div>
        <p>Loading recent notes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`user-notes-error ${className}`}>
        <p>{error}</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`user-notes-empty ${className}`}>
        <p>No notes found</p>
      </div>
    );
  }

  return (
    <div className={`user-notes-container ${className}`}>
      <div className="user-notes-list">
        {notes.map((note) => (
          <MiniNote key={note.id} event={note} />
        ))}
      </div>
      
      {notes.length > 0 && (
        <button 
          style={viewAllButtonStyle}
          onClick={navigateToProfile}
          title="View all notes from this user"
        >
          View All Notes
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
} 