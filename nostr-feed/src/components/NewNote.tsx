import { useState } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { ContentEmbeds } from './ContentEmbeds';

export function NewNote() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { publishNote, currentUser } = useNostrContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please login to post');
      return;
    }
    
    if (!content.trim()) {
      alert('Please enter some content');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const eventId = await publishNote(content);
      if (eventId) {
        setContent('');
        setShowPreview(false);
      }
    } catch (error) {
      console.error('Failed to publish note:', error);
      alert('Failed to publish note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="new-note-container">
      <form onSubmit={handleSubmit}>
        <textarea
          className="new-note-input"
          placeholder="What's happening?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!currentUser || isSubmitting}
        />
        
        {showPreview && content && (
          <div className="note-preview">
            <h4>Preview</h4>
            <div className="preview-content">
              <ContentEmbeds content={content} maxEmbeds={3} removeUrls={false} />
            </div>
          </div>
        )}
        
        <div className="new-note-actions">
          <button 
            type="button"
            className="preview-button"
            onClick={togglePreview}
            disabled={!content || isSubmitting}
          >
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          
          <button 
            type="submit"
            className="submit-button"
            disabled={!currentUser || !content.trim() || isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
} 