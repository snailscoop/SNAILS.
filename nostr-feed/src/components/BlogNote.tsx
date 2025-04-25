import { useState, useEffect, useMemo } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useNostrContext } from '../contexts/useNostrContext';
import { Profile } from '../db';
import { BlogModal } from './BlogModal';
import { Nip23Event } from '../types';
import { 
  RepostIcon, 
  ReplyIcon, 
  LikeIcon, 
  ShareIcon 
} from './ActionIcons';
import { ContentEmbeds } from './ContentEmbeds';
import { extractEmbeds } from '../utils/urlEmbed';

interface BlogNoteProps {
  event: NDKEvent;
}

export function BlogNote({ event }: BlogNoteProps) {
  const { fetchProfile, verifyNip05, encodePublicKey } = useNostrContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [npub, setNpub] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  // Get title from content or tags according to NIP-23
  const title = useMemo(() => {
    // Helper function to check if text is a Nostr identifier
    const isNostrIdentifier = (text: string): boolean => {
      const patterns = [
        /^nostr:(?:nprofile|nevent|note|event|npub)/i,
        /^(?:nprofile|nevent|note|event|npub)1[a-z0-9]{6,}/i
      ];
      return patterns.some(pattern => pattern.test(text.trim()));
    };

    // First check if there's a title tag (as per NIP-23)
    const titleTag = event.tags?.find(tag => tag[0] === 'title');
    if (titleTag && titleTag[1] && titleTag[1].trim() && 
        titleTag[1].trim() !== 'Untitled Blog Post' && 
        titleTag[1].trim() !== 'Blog Post' && 
        !isNostrIdentifier(titleTag[1])) {
      return titleTag[1];
    }
    
    // Try to extract a title from the content
    try {
      // Check if content is JSON
      const contentObj = JSON.parse(event.content);
      if (contentObj.title && contentObj.title.trim() !== 'Untitled Blog Post' && 
          contentObj.title.trim() !== 'Blog Post' &&
          !isNostrIdentifier(contentObj.title)) {
        return contentObj.title;
      }
    } catch {
      // Not JSON, try to get first line as title
      const firstLine = event.content.split('\n')[0];
      if (firstLine && firstLine.length > 0 && firstLine.length < 100 && 
          firstLine.trim() !== 'Untitled Blog Post' && 
          firstLine.trim() !== 'Blog Post' &&
          !isNostrIdentifier(firstLine)) {
        return firstLine;
      }
      
      // If first line isn't suitable, try to extract a meaningful title from content
      const paragraphs = event.content.split('\n\n');
      for (const paragraph of paragraphs) {
        const cleanPara = paragraph.trim();
        if (cleanPara && cleanPara.length > 10 && cleanPara.length < 100 && 
            !cleanPara.startsWith('http') && 
            !cleanPara.includes('Untitled Blog Post') && 
            !cleanPara.includes('Blog Post') &&
            !isNostrIdentifier(cleanPara)) {
          return cleanPara;
        }
      }
    }
    
    // If we couldn't find a valid title, extract something meaningful from the content
    const contentWords = event.content.split(/\s+/).filter(word => 
      word.length > 3 && 
      !['http', 'www'].some(prefix => word.toLowerCase().startsWith(prefix)) &&
      !isNostrIdentifier(word)
    ).slice(0, 5);
    
    if (contentWords.length > 0) {
      return contentWords.join(' ') + '...';
    }
    
    // If all else fails
    return 'Post';
  }, [event]);
  
  // Get summary/excerpt according to NIP-23
  const summary = useMemo(() => {
    // First check if there's a summary tag (as per NIP-23)
    const summaryTag = event.tags?.find(tag => tag[0] === 'summary');
    if (summaryTag && summaryTag[1]) {
      return summaryTag[1];
    }
    
    // Try to extract summary from content
    try {
      const contentObj = JSON.parse(event.content);
      if (contentObj.summary) {
        return contentObj.summary;
      }
    } catch {
      // Not JSON, create an excerpt - improved to get more content
      const text = event.content.replace(/#+\s+/g, ''); // Remove markdown headers
      
      // Get first 2-3 paragraphs instead of just one
      const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
      
      if (paragraphs.length > 0) {
        // Include multiple paragraphs up to 400 characters
        let excerpt = '';
        for (const para of paragraphs) {
          if (excerpt.length + para.length < 400) {
            excerpt += (excerpt ? '\n\n' : '') + para;
          } else {
            // Cut the paragraph to fit within 400 chars if needed
            const remainingSpace = 400 - excerpt.length;
            if (remainingSpace > 50) { // Only add if we can show a meaningful amount
              excerpt += (excerpt ? '\n\n' : '') + para.substring(0, remainingSpace - 3) + '...';
            }
            break;
          }
        }
        
        return excerpt || paragraphs[0].substring(0, 397) + '...';
      }
    }
    
    // Default summary
    return 'Click to read this blog post...';
  }, [event]);

  // Get featured image if available (NIP-23)
  const featuredImage = useMemo(() => {
    // Check for image tag as defined in NIP-23
    const imageTag = event.tags?.find(tag => tag[0] === 'image');
    if (imageTag && imageTag[1]) {
      return imageTag[1]; // Return the image URL
    }
    return null;
  }, [event]);

  // Get published date if available (NIP-23)
  const publishedAt = useMemo(() => {
    // Check for published_at tag as defined in NIP-23
    const publishedTag = event.tags?.find(tag => tag[0] === 'published_at');
    if (publishedTag && publishedTag[1]) {
      try {
        // Convert to readable date
        const publishTimestamp = parseInt(publishedTag[1]);
        if (!isNaN(publishTimestamp)) {
          return new Date(publishTimestamp * 1000).toLocaleDateString();
        }
      } catch {
        // If parsing fails, fall back to created_at
        return null;
      }
    }
    return null;
  }, [event]);

  // Format content for display - improved markdown conversion
  const formattedContent = useMemo(() => {
    try {
      // Better formatting to improve readability
      return event.content
        .replace(/\n\n/g, '</p><p>') // Paragraphs
        .replace(/\n/g, '<br />') // Line breaks
        .replace(/^#+\s+(.+)$/gm, '<h3>$1</h3>') // Headers
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.+?)\*/g, '<em>$1</em>') // Italic
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="blog-content-image">') // Images
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>') // Links
        .replace(/^(.+)$/m, '<p>$1</p>'); // Wrap remaining text in paragraphs
    } catch (e) {
      console.error('Error formatting content:', e);
      return `<p>${event.content}</p>`;
    }
  }, [event.content]);

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
        // For blog posts, show full date for older posts
        const date = new Date(event.created_at * 1000);
        setTimeAgo(date.toLocaleDateString());
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

  // Extract tags for the blog post (if any)
  const extractedTags = useMemo(() => {
    const hashtags = event.tags?.filter(tag => tag[0] === 't').map(tag => tag[1]) || [];
    return hashtags;
  }, [event.tags]);
  
  // Convert the NDKEvent to a Nip23Event for the modal
  const nip23Event: Nip23Event = useMemo(() => ({
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    title: title,
    image: featuredImage || undefined,
    tags: extractedTags,
    published_at: publishedAt ? new Date(publishedAt).getTime() / 1000 : undefined,
    created_at: event.created_at
  }), [event, title, featuredImage, extractedTags, publishedAt]);

  // Extract embeds from the content
  const contentEmbeds = useMemo(() => {
    return extractEmbeds(event.content);
  }, [event.content]);
  
  // Determine if we have embeds to show
  const hasEmbeds = useMemo(() => {
    return contentEmbeds.length > 0;
  }, [contentEmbeds]);

  const handleReadMoreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="blog-note">
      <div className="blog-header">
        {profile ? (
          <div className="profile-info">
            <img 
              src={profile.picture || '/default-avatar.png'} 
              alt={profile.name || 'User'} 
              className="profile-picture" 
            />
            <div className="profile-details">
              <div className="profile-name-container">
                <span className="profile-name">{profile.displayName || profile.name || 'Anonymous'}</span>
                {verified && <span className="verified-badge">✓</span>}
              </div>
              <a href={`/profile/${npub}`} className="profile-handle">
                @{profile.name || npub?.substring(0, 8)}
              </a>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <img src="/default-avatar.png" alt="User" className="profile-picture" />
            <div className="profile-details">
              <span className="profile-name">Anonymous</span>
              <span className="profile-handle">@{npub?.substring(0, 8)}</span>
            </div>
          </div>
        )}
        <span className="blog-time">{timeAgo}</span>
      </div>
      
      <div className="blog-content">
        <h2 className="blog-title">{title}</h2>
        {featuredImage && (
          <div className="blog-featured-image">
            <img src={featuredImage} alt={title} />
          </div>
        )}
        <div className="blog-summary" dangerouslySetInnerHTML={{ __html: summary }} />
        
        {/* Add embed previews */}
        {hasEmbeds && (
          <div className="blog-embeds-preview">
            <ContentEmbeds content={event.content} maxEmbeds={2} removeUrls={true} />
          </div>
        )}
        
        <div className="blog-actions">
          <button className="read-more-button" onClick={handleReadMoreClick}>
            Read more
          </button>
          
          {extractedTags.length > 0 && (
            <div className="blog-tags">
              {extractedTags.slice(0, 3).map((tag, index) => (
                <span key={index} className="blog-tag">#{tag}</span>
              ))}
              {extractedTags.length > 3 && <span className="more-tags">+{extractedTags.length - 3}</span>}
            </div>
          )}
        </div>
      </div>
      
      <div className="blog-footer">
        <div className="blog-actions">
          <button className="action-button">
            <ReplyIcon />
          </button>
          <button className="action-button">
            <RepostIcon />
          </button>
          <button className="action-button">
            <LikeIcon />
          </button>
          <button className="action-button">
            <ShareIcon />
          </button>
        </div>
      </div>
      
      {/* The blog post modal */}
      {isModalOpen && (
        <BlogModal
          isOpen={true}
          onClose={closeModal}
          blogData={nip23Event}
          title={title}
          content={formattedContent}
          tags={extractedTags}
          profileName={profile?.displayName || profile?.name}
          profileImage={profile?.picture}
          publishedAt={publishedAt || timeAgo}
        />
      )}
    </div>
  );
} 