import { Modal } from './Modal';
import { Nip23Event } from '../types';
import { Tag } from '../components/Tag';
import { useCallback } from 'react';
import { ContentEmbeds } from './ContentEmbeds';

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
  blogData: Nip23Event;
  title: string;
  content: string;
  tags?: string[];
  profileName?: string;
  profileImage?: string;
  publishedAt?: string;
}

export function BlogModal({
  isOpen,
  onClose,
  blogData,
  title,
  content,
  tags,
  profileName,
  profileImage,
  publishedAt
}: BlogModalProps) {
  // Memoize the onClose handler to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="blog-modal">
        <div className="blog-modal-header">
          {profileImage && (
            <img 
              src={profileImage} 
              alt={profileName || 'Author'} 
              className="blog-modal-author-img" 
            />
          )}
          <div className="blog-modal-meta">
            {profileName && <div className="blog-modal-author">{profileName}</div>}
            {publishedAt && <div className="blog-modal-date">{publishedAt}</div>}
          </div>
        </div>
        
        {blogData.image && (
          <div className="blog-modal-featured-image">
            <img src={blogData.image} alt={title} />
          </div>
        )}
        
        <div className="blog-modal-content" dangerouslySetInnerHTML={{ __html: content }} />
        
        {/* Add link previews from the blog content */}
        {blogData.content && (
          <div className="blog-modal-embeds">
            <ContentEmbeds 
              content={blogData.content} 
              maxEmbeds={5} 
              removeUrls={false} 
            />
          </div>
        )}
        
        {tags && tags.length > 0 && (
          <div className="blog-modal-tags">
            {tags.map((tag, index) => (
              <Tag key={index} text={tag} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
} 