import { useState } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';

interface ComposeNoteProps {
  onSuccess?: () => void;
}

export function ComposeNote({ onSuccess }: ComposeNoteProps) {
  const { publishNote, currentUser, isLoading } = useNostrContext();
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Note content cannot be empty');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to publish notes');
      return;
    }
    
    setIsPublishing(true);
    setError(null);
    
    try {
      const event = await publishNote(content);
      if (event) {
        setContent('');
        if (onSuccess) onSuccess();
      } else {
        setError('Failed to publish note');
      }
    } catch (err) {
      setError('An error occurred while publishing your note');
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="compose-note">
      <form onSubmit={handleSubmit}>
        <div className="compose-header">
          <h3>Compose New Note</h3>
        </div>
        
        <textarea
          placeholder="What's happening?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={280}
          disabled={isPublishing || isLoading || !currentUser}
        />
        
        <div className="compose-footer">
          <div className="char-count">
            {content.length}/280
          </div>
          
          <button
            type="submit"
            disabled={isPublishing || isLoading || !currentUser || !content.trim()}
            className="publish-button"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {!currentUser && !isLoading && (
          <div className="login-message">
            You need to log in to publish notes
          </div>
        )}
      </form>
    </div>
  );
} 