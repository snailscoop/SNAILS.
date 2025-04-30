import React, { useState, useMemo, useCallback, useEffect, useRef, SyntheticEvent } from 'react';
import {
  FiLink,
  FiType,
  FiBold,
  FiItalic,
  FiCode,
  FiList,
  FiImage,
  FiUpload,
  FiEye,
  FiEdit,
} from 'react-icons/fi';
import { BiHeading } from 'react-icons/bi';
import { TbQuote } from 'react-icons/tb';
import { BlogFeed } from '../components/BlogFeed';
import { LatestBlogFeed } from '../components/LatestBlogFeed';
import { TrendingHashtags } from '../components/TrendingHashtags';
import { useNostrContext } from '../contexts/useNostrContext';
import { ProfileCard } from '../components/ProfileCard';
import { BombHeader } from '../components/BombHeader';
import { ContentEmbeds } from '../components/ContentEmbeds';

export function SnailsPubPage() {
  const { isConnected, isLoading, saveRelays, currentUser, getFollowing, publishLongformContent, createFileMetadata } = useNostrContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('latest');
  const [userFollowing, setUserFollowing] = useState<string[]>([]);
  const [followedContent, setFollowedContent] = useState<{content: string, id: string}[]>([]);
  const [showEmbeds, setShowEmbeds] = useState(true);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogDescription, setBlogDescription] = useState('');
  const [blogTags, setBlogTags] = useState('');
  const [blogImage, setBlogImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [blogContent, setBlogContent] = useState<string>('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [currentFormat, setCurrentFormat] = useState('p');
  const [textAlign, setTextAlign] = useState('left');
  const [imageUrl, setImageUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [textColor, setTextColor] = useState('#e0f2ff');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showInlineImageUpload, setShowInlineImageUpload] = useState(false);
  const [inlineImageFile, setInlineImageFile] = useState<File | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  // Add a state for toast notifications near the top of the component
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Connect to blog-specific relays for better content discovery
  useEffect(() => {
    const connectToRecommendedRelays = async () => {
      // These are relays known to have good blog content
      const blogRelays = [
        'wss://relay.nostr.band', // Good search functionality
        'wss://nos.lol', // Popular relay with good content
        'wss://relay.damus.io', // Another popular relay
        'wss://relay.snort.social', // Good for blog content
        'wss://nostr.wine' // High-quality content relay
      ];
      
      // Save these relays using the available method from context
      try {
        await saveRelays(blogRelays);
        console.log('Connected to blog relays for better content discovery');
      } catch (e) {
        console.warn('Failed to connect to blog relays:', e);
      }
    };
    
    connectToRecommendedRelays();
  }, [saveRelays]);

  // Load user's following list
  useEffect(() => {
    if (isConnected && currentUser) {
      const loadFollowing = async () => {
        try {
          const following = await getFollowing(currentUser.pubkey);
          setUserFollowing(following);
          console.log('Loaded following list:', following.length, 'accounts');
        } catch (e) {
          console.error('Failed to load following list:', e);
        }
      };
      
      loadFollowing();
    }
  }, [isConnected, currentUser, getFollowing]);

  // Create a filter specifically for long-form content (kind 30023 for articles)
  // NIP-23 defines kind:30023 as the event kind for long-form content (blogs/articles)
  const blogFilter = useMemo(() => {
    // Get articles from the last 90 days for a much broader selection
    // Habla.news uses a longer timeframe to find more quality content
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
    return {
      kinds: [30023], // Long-form content kind (NIP-23)
      since: ninetyDaysAgo,
      limit: 100 // Increased limit for more content
    };
  }, []);
  
  // Popular blog filter with sorting by created_at
  const popularBlogFilter = useMemo(() => {
    // Get articles from the last 30 days for popular content
    // This gives us recent but still popular content
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    return {
      kinds: [30023],
      since: thirtyDaysAgo,
      limit: 75 // Increased limit for more content discovery
    };
  }, []);

  // Following filter based on user follows (now implemented)
  const followingBlogFilter = useMemo(() => {
    // Get articles from the last 180 days for followed authors
    // Longer timeframe because we care more about authors we follow
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 86400;
    
    // Only add authors filter if we have following data
    if (userFollowing.length === 0) {
      return {
        kinds: [30023],
        since: sixMonthsAgo,
        limit: 100 // Higher limit for followed authors
      };
    }
    
    return {
      kinds: [30023],
      since: sixMonthsAgo,
      authors: userFollowing,
      limit: 100 // Higher limit for followed authors
    };
  }, [userFollowing]);
  
  // Example followed content with embeds for demonstration
  useEffect(() => {
    if (activeTab === 'following' && userFollowing.length > 0) {
      // Add some placeholder content until the feed loads
      setFollowedContent([
        { 
          content: "Check out this great tutorial on Nostr development https://github.com/nostr-protocol/nostr", 
          id: "demo1" 
        },
        { 
          content: "I found this interesting YouTube video about decentralized social networks https://www.youtube.com/watch?v=dQw4w9WgXcQ", 
          id: "demo2" 
        }
      ]);
    }
  }, [activeTab, userFollowing.length]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    // Force refresh the feed
    setRefreshKey(prev => prev + 1);
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [isRefreshing]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);

  const toggleEmbeds = useCallback(() => {
    setShowEmbeds(prev => !prev);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    
    if (file) {
      // For the cover image preview
      setBlogImage(file);
      const reader = new FileReader();
      
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        if (imagePreviewRef.current) {
          imagePreviewRef.current.classList.add('has-image');
          imagePreviewRef.current.style.backgroundImage = `url(${reader.result})`;
        }
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  const handlePublish = async () => {
    if (!blogTitle.trim()) {
      alert("Please enter a title for your blog post");
      return;
    }

    if (!blogContent.trim()) {
      alert("Please add some content to your blog post");
      return;
    }

    // Show publishing indicator
    setIsPublishing(true);

    try {
      // Split tags by comma and trim whitespace
      const tagsArray = blogTags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Get image URL 
      let imageUrl = '';
      
      // If we have a blog image file, we need to upload it first
      if (blogImage) {
        try {
          // Upload to nostr.build service
          const formData = new FormData();
          formData.append('fileToUpload', blogImage);
          
          const response = await fetch('https://nostr.build/api/v2/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.status === 'success' && data.data && data.data.url) {
            imageUrl = data.data.url;
            console.log('Image uploaded successfully:', imageUrl);
            
            // Create file metadata using NIP-94
            try {
              if (createFileMetadata) {
                await createFileMetadata(
                  imageUrl,
                  blogImage.name,
                  blogImage.size,
                  blogImage.type,
                  undefined, // hash
                  undefined, // magnetURI
                  undefined, // torrentInfoHash
                  `Cover image for blog post: ${blogTitle}`,
                  undefined, // dimensions
                  undefined  // blurhash
                );
                
                console.log('File metadata created successfully');
              }
            } catch (metadataError) {
              console.warn('Failed to create file metadata, but continuing with publish:', metadataError);
              // Still continue with the blog post publishing even if metadata creation fails
            }
            
            setToastMessage('Cover image uploaded successfully!');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          } else {
            throw new Error('Invalid response from upload service');
          }
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          alert('Failed to upload image. Continuing with post without cover image.');
          imageUrl = ''; // Reset image URL so post continues without image
        }
      }
      
      // Call the Nostr service to publish long-form content
      const event = await publishLongformContent(
        blogTitle,
        blogContent,
        blogDescription,
        imageUrl,
        tagsArray
      );
      
      if (event) {
        // Successfully published
        alert('Blog post published successfully!');
        
        // Reset form after publishing
        setBlogTitle('');
        setBlogDescription('');
        setBlogTags('');
        setBlogImage(null);
        setImagePreview('');
        setBlogContent('');
        if (imagePreviewRef.current) {
          imagePreviewRef.current.classList.remove('has-image');
          imagePreviewRef.current.style.backgroundImage = '';
        }
        
        // Refresh the feed to include the new post
        setRefreshKey(prev => prev + 1);
      } else {
        alert('Failed to publish blog post. Please try again.');
      }
    } catch (error) {
      console.error('Error publishing blog post:', error);
      alert('An error occurred while publishing your blog post.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      
      // Insert tab character
      const newValue = blogContent.substring(0, start) + '    ' + blogContent.substring(end);
      
      // Update state
      setBlogContent(newValue);
      
      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const handleInlineImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      insertInlineImage(file);
      setShowInlineImageUpload(false);
    }
  };

  const insertInlineImage = (file: File) => {
    setIsPublishing(true); // Reuse publishing state for upload indicator
    
    // First upload the image to nostr.build
    const uploadImage = async (file: File) => {
      try {
        const formData = new FormData();
        formData.append('fileToUpload', file);
        
        const response = await fetch('https://nostr.build/api/v2/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.data && data.data.url) {
          const imageUrl = data.data.url;
          console.log('Inline image uploaded successfully:', imageUrl);
          
          // Create file metadata
          try {
            if (createFileMetadata) {
              await createFileMetadata(
                imageUrl,
                file.name,
                file.size,
                file.type,
                undefined, // hash
                undefined, // magnetURI
                undefined, // torrentInfoHash
                `Inline image for blog post`,
                undefined, // dimensions
                undefined  // blurhash
              );
            }
          } catch (err) {
            console.warn('Failed to create file metadata for inline image:', err);
          }
          
          // Insert the image URL as markdown in the editor
          const cursorPosition = editorRef.current?.selectionStart ?? 0;
          const markdownImage = `![Image](${imageUrl})`;
          const newContent = blogContent.substring(0, cursorPosition) + 
            markdownImage + 
            blogContent.substring(cursorPosition);
          setBlogContent(newContent);
          
          setToastMessage('Image uploaded successfully!');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } else {
          throw new Error('Invalid response from upload service');
        }
      } catch (error) {
        console.error('Failed to upload inline image:', error);
        alert('Failed to upload image. Please try again or use an image URL instead.');
        
        // Fallback to data URL if upload fails
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const cursorPosition = editorRef.current?.selectionStart ?? 0;
          const imageUrl = e.target?.result as string;
          const markdownImage = `![Image](${imageUrl})`;
          const newContent = blogContent.substring(0, cursorPosition) + 
            markdownImage + 
            blogContent.substring(cursorPosition);
          setBlogContent(newContent);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsPublishing(false);
      }
    };
    
    uploadImage(file);
  };

  const insertImage = () => {
    if (!imageUrl.trim()) return;
    
    if (editorRef.current) {
      const textArea = editorRef.current;
      const start = textArea.selectionStart;
      
      // Insert markdown image tag
      const imageMarkdown = `![Image](${imageUrl})`;
      const newText = blogContent.substring(0, start) + imageMarkdown + blogContent.substring(start);
      setBlogContent(newText);
      
      // Reset the image URL input
      setImageUrl('');
      setShowImageInput(false);
      
      // Place cursor after the inserted image
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + imageMarkdown.length;
        }
      }, 0);
    }
  };

  const handleEditorMouseUp = () => {
    if (editorRef.current) {
      const selectedText = blogContent.substring(
        editorRef.current.selectionStart,
        editorRef.current.selectionEnd
      );
      
      if (selectedText) {
        // Check if selected text is bold
        setIsBold(selectedText.startsWith('**') && selectedText.endsWith('**'));
        
        // Check if selected text is italic
        setIsItalic(selectedText.startsWith('*') && selectedText.endsWith('*') && 
                  !(selectedText.startsWith('**') && selectedText.endsWith('**')));
        
        // More format checks could be added here
      }
    }
  };

  const toggleAlignment = (align: string) => {
    // In real Markdown, there's no direct alignment, but we can use a custom approach
    // For this example, we'll wrap the current line in a div with style
    if (editorRef.current) {
      const textArea = editorRef.current;
      const text = blogContent;
      
      // Find the start and end of the current line
      const cursorPos = textArea.selectionStart;
      let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
      let lineEnd = text.indexOf('\n', cursorPos);
      if (lineEnd === -1) lineEnd = text.length;
      
      const currentLine = text.substring(lineStart, lineEnd);
      
      // Create an aligned version using HTML (since Markdown doesn't directly support alignment)
      const alignedLine = `<div style="text-align: ${align};">${currentLine}</div>`;
      
      // Replace the line in the content
      const newContent = text.substring(0, lineStart) + alignedLine + text.substring(lineEnd);
      setBlogContent(newContent);
      setTextAlign(align);
    }
  };

  const applyTextColor = (color: string) => {
    if (editorRef.current) {
      const textArea = editorRef.current;
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const selectedText = blogContent.substring(start, end);
      
      if (selectedText) {
        // Using HTML span for color since Markdown doesn't natively support text color
        const coloredText = `<span style="color: ${color};">${selectedText}</span>`;
        const newText = blogContent.substring(0, start) + coloredText + blogContent.substring(end);
        setBlogContent(newText);
        setTextColor(color);
      }
    }
    setShowColorPicker(false);
  };

  const insertTable = () => {
    const tableTemplate = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1    | Data     | Data     |
| Row 2    | Data     | Data     |
    `;
    
    if (editorRef.current) {
      const textArea = editorRef.current;
      const start = textArea.selectionStart;
      
      const newText = blogContent.substring(0, start) + tableTemplate + blogContent.substring(start);
      setBlogContent(newText);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + tableTemplate.length;
        }
      }, 0);
    }
  };

  const insertCodeBlock = () => {
    const codeTemplate = "```\nYour code here\n```";
    
    if (editorRef.current) {
      const textArea = editorRef.current;
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      
      // If text is selected, wrap it in code block
      if (start !== end) {
        const selectedText = blogContent.substring(start, end);
        const wrappedCode = "```\n" + selectedText + "\n```";
        const newText = blogContent.substring(0, start) + wrappedCode + blogContent.substring(end);
        setBlogContent(newText);
      } else {
        // Insert template code block
        const newText = blogContent.substring(0, start) + codeTemplate + blogContent.substring(end);
        setBlogContent(newText);
        
        // Position cursor inside the code block
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 4;
          }
        }, 0);
      }
    }
  };

  // Function to convert markdown to HTML for preview
  const renderMarkdown = (text: string): string => {
    // Very basic markdown parsing for preview
    // In a production app, you should use a proper markdown parser library
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Images
      .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1" style="max-width: 100%;" />')
      // Lists
      .replace(/^\s*\n\* (.*)/gm, '<ul>\n<li>$1</li>')
      .replace(/^\* (.*)/gm, '<li>$1</li>')
      .replace(/<\/li>\s*\n\* (.*)/gm, '</li>\n<li>$1</li>')
      .replace(/<\/li>\s*\n<\/ul>/gm, '</li></ul>')
      .replace(/^\s*\n[0-9]+\. (.*)/gm, '<ol>\n<li>$1</li>')
      .replace(/^[0-9]+\. (.*)/gm, '<li>$1</li>')
      .replace(/<\/li>\s*\n[0-9]+\. (.*)/gm, '</li>\n<li>$1</li>')
      .replace(/<\/li>\s*\n<\/ol>/gm, '</li></ol>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Code blocks
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      // Line breaks
      .replace(/\n/gim, '<br />');
    
    return html;
  };

  const renderLatestContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }

    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Latest Blogs</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="note-style-feed">
          <LatestBlogFeed key={refreshKey} filter={blogFilter} limit={50} />
        </div>
      </div>
    );
  };

  const renderPopularContent = () => {
    if (isLoading && !isConnected) {
      return (
        <div className="loading-container">
          <p>Connecting to Nostr network...</p>
        </div>
      );
    }
    
    return (
      <div className="feed-wrapper">
        <div className="feed-header">
          <h2>Popular Blogs</h2>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="refresh-button"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="popular-blogs-description">
          <p>Recent articles from the Nostr network</p>
        </div>
        <BlogFeed key={refreshKey} filter={popularBlogFilter} limit={50} />
      </div>
    );
  };

  const renderFollowingContent = () => (
    <div className="following-container">
      <h2>Blogs from People You Follow</h2>
      {isConnected ? (
        userFollowing.length > 0 ? (
          <div className="following-feed">
            <div className="feed-header">
              <div className="feed-controls">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="refresh-button"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={toggleEmbeds}
                  className="embed-toggle-button"
                >
                  {showEmbeds ? 'Hide Embeds' : 'Show Embeds'}
                </button>
              </div>
            </div>
            
            <BlogFeed key={refreshKey} filter={followingBlogFilter} limit={50} />
            
            {/* Demo of ContentEmbeds functionality */}
            {showEmbeds && followedContent.length > 0 && (
              <div className="embeds-demo">
                <h3>Content Embeds Demo</h3>
                {followedContent.map(item => (
                  <div key={item.id} className="embed-example">
                    <p>{item.content}</p>
                    <ContentEmbeds content={item.content} maxEmbeds={3} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="no-following">
            <p>You're not following anyone yet.</p>
            <p>Follow some Nostr users to see their blog posts here.</p>
          </div>
        )
      ) : (
        <p>Connect to see blogs from people you follow</p>
      )}
    </div>
  );

  const renderCreateContent = () => (
    <div 
      className="create-blog-container" 
      style={{ 
        maxHeight: 'calc(100vh - 150px)', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem',
        justifyContent: 'center',
        padding: '1rem',
        width: '100%'
      }}
    >
      <div className="note-card editor-card" style={{ 
        flex: 1, 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', 
        borderColor: 'transparent', 
        border: 'none',
        background: 'var(--card-bg-color)',
        maxWidth: 'calc(100% - 32px)',
        margin: '0 auto',
        width: '100%',
        outline: 'none'
      }}>
        <div className="note-content blog-editor-container" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none' }}>
          <div className="medium-toolbar">
            <div className="toolbar-group">
              <button 
                className={`medium-toolbar-button ${isBold ? 'active' : ''}`} 
                onClick={() => insertFormat('**', '**')}
                title="Bold"
              >
                <FiBold />
              </button>
              <button 
                className={`medium-toolbar-button ${isItalic ? 'active' : ''}`} 
                onClick={() => insertFormat('*', '*')}
                title="Italic"
              >
                <FiItalic />
              </button>
              <button 
                className="medium-toolbar-button" 
                onClick={() => insertFormat('### ', '')}
                title="Heading"
              >
                <BiHeading />
              </button>
            </div>

            <div className="toolbar-group">
              <button 
                className="medium-toolbar-button" 
                onClick={() => insertFormat('> ', '')}
                title="Quote"
              >
                <TbQuote />
              </button>
              <button 
                className="medium-toolbar-button" 
                onClick={() => insertFormat('- ', '')}
                title="Bullet list"
              >
                <FiList />
              </button>
              <button
                className="medium-toolbar-button"
                onClick={() => {
                  const cursorPosition = editorRef.current?.selectionStart ?? 0;
                  insertList(cursorPosition);
                }}
                title="List"
              >
                <FiList />
              </button>
            </div>

            <div className="toolbar-group">
              <button
                className="medium-toolbar-button"
                onClick={() => {
                  const cursorPosition = editorRef.current?.selectionStart ?? 0;
                  insertList(cursorPosition);
                }}
                title="List"
              >
                <FiList />
              </button>
              <button
                className="medium-toolbar-button"
                onClick={() => {
                  setShowLinkInput(!showLinkInput);
                  setShowImageInput(false);
                }}
                title="Add link"
              >
                <FiLink />
              </button>
              <button
                className="medium-toolbar-button"
                onClick={() => {
                  setShowImageInput(!showImageInput);
                  setShowLinkInput(false);
                }}
                title="Add image URL"
              >
                <FiImage />
              </button>
              <button
                className="medium-toolbar-button"
                onClick={() => {
                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  fileInput.accept = 'image/*';
                  fileInput.onchange = (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files[0]) {
                      const file = target.files[0];
                      // Create a synthetic event to pass to handleImageUpload
                      const syntheticEvent = {
                        target: {
                          files: target.files
                        }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleImageUpload(syntheticEvent);
                    }
                  };
                  fileInput.click();
                }}
                title="Upload image"
              >
                <FiUpload />
              </button>
              <button 
                className="medium-toolbar-button" 
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                title="More options"
              >
                &hellip;
              </button>
              {showAdvancedOptions && (
                <div className="dropdown-content">
                  <button onClick={() => toggleAlignment('left')}>Align Left</button>
                  <button onClick={() => toggleAlignment('center')}>Align Center</button>
                  <button onClick={() => toggleAlignment('right')}>Align Right</button>
                  <button onClick={() => insertCodeBlock()}>Code Block</button>
                  <button onClick={() => insertTable()}>Insert Table</button>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}>Text Color</button>
                </div>
              )}
              {showColorPicker && (
                <div className="color-picker">
                  <div className="color-option" onClick={() => applyTextColor('#e0f2ff')} style={{backgroundColor: '#e0f2ff'}}></div>
                  <div className="color-option" onClick={() => applyTextColor('#ff5757')} style={{backgroundColor: '#ff5757'}}></div>
                  <div className="color-option" onClick={() => applyTextColor('#59a9ff')} style={{backgroundColor: '#59a9ff'}}></div>
                  <div className="color-option" onClick={() => applyTextColor('#a3ff78')} style={{backgroundColor: '#a3ff78'}}></div>
                  <div className="color-option" onClick={() => applyTextColor('#ffcc29')} style={{backgroundColor: '#ffcc29'}}></div>
                </div>
              )}
            </div>

            {/* Preview toggle buttons */}
            <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
              <button
                className={`medium-toolbar-button ${showPreview ? '' : 'active'}`}
                onClick={() => setShowPreview(false)}
                title="Edit"
              >
                <FiEdit />
              </button>
              <button
                className={`medium-toolbar-button ${showPreview ? 'active' : ''}`}
                onClick={() => setShowPreview(true)}
                title="Preview"
              >
                <FiEye />
              </button>
            </div>
          </div>

          {showInlineImageUpload && (
            <div className="image-input-container">
              <div className="image-upload-options">
                <button 
                  className="image-upload-button"
                  onClick={() => inlineFileInputRef.current?.click()}
                >
                  <FiUpload className="upload-icon" />
                  Upload from device
                </button>
                <input 
                  type="file" 
                  ref={inlineFileInputRef} 
                  onChange={handleInlineImageUpload} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
                <span className="option-divider">or</span>
                <button 
                  className="image-url-button"
                  onClick={() => {
                    setShowImageInput(true);
                    setShowInlineImageUpload(false);
                  }}
                >
                  <FiLink className="url-icon" />
                  Enter image URL
                </button>
              </div>
              <button 
                onClick={() => setShowInlineImageUpload(false)}
                className="image-cancel-button"
              >
                Cancel
              </button>
            </div>
          )}

          {showImageInput && (
            <div className="image-input-container">
              <input 
                type="text" 
                placeholder="Enter image URL" 
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="image-url-input"
              />
              <button 
                onClick={insertImage}
                className="image-insert-button"
              >
                Insert
              </button>
              <button 
                onClick={() => setShowImageInput(false)}
                className="image-cancel-button"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="editor-scroll-container" style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: '300px' }}>
            {!showPreview ? (
              <textarea
                ref={editorRef}
                value={blogContent}
                onChange={(e) => {
                  setBlogContent(e.target.value);
                  // Auto-adjust height
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                onMouseUp={handleEditorMouseUp}
                placeholder="Write your blog post here..."
                className="medium-editor"
                style={{ 
                  minHeight: '100%',
                  height: 'auto',
                  width: '100%',
                  padding: '20px 25px',
                  boxSizing: 'border-box',
                  backgroundColor: 'transparent',
                  color: 'var(--text-color)',
                  border: 'none',
                  outline: 'none',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  boxShadow: 'none',
                  resize: 'vertical',
                  overflow: 'hidden'
                }}
              />
            ) : (
              <div 
                className="markdown-preview"
                style={{
                  padding: '20px 25px',
                  minHeight: '100%',
                  height: '100%',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflow: 'auto',
                  color: 'var(--text-color)',
                  fontSize: '16px',
                  lineHeight: '1.6'
                }}
              >
                <h1 className="preview-title">{blogTitle || 'Untitled Blog Post'}</h1>
                {blogDescription && <p className="preview-description">{blogDescription}</p>}
                {imagePreview && (
                  <div className="preview-featured-image">
                    <img src={imagePreview} alt="Featured" style={{ maxWidth: '100%', marginBottom: '20px', borderRadius: 'var(--border-radius)' }} />
                  </div>
                )}
                <div 
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(blogContent) }}
                />
                {blogTags && (
                  <div className="preview-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                    {blogTags.split(',').map((tag, index) => (
                      tag.trim() && (
                        <span key={index} className="preview-tag" style={{ 
                          backgroundColor: 'rgba(0, 102, 204, 0.2)', 
                          color: 'var(--text-color)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.875rem'
                        }}>
                          #{tag.trim()}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="note-card blog-creation-card" style={{ 
        overflow: 'visible', 
        background: 'var(--card-bg-color)', 
        border: '1px solid var(--border-color)',
        maxWidth: 'calc(100% - 32px)',
        margin: '0 auto',
        width: '100%',
        borderRadius: 'var(--border-radius)',
        position: 'relative'
      }}>
        <div className="note-content" style={{ padding: '12px 16px' }}>
          <form className="blog-form" onSubmit={(e) => e.preventDefault()}>
            <div style={{ display: 'flex', gap: '16px' }}>
              {/* Left column - Text fields */}
              <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="form-group" style={{ margin: '0' }}>
                  <input 
                    type="text" 
                    id="blog-title" 
                    placeholder="Enter a title for your blog post" 
                    className="form-control"
                    value={blogTitle}
                    onChange={(e) => setBlogTitle(e.target.value)}
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      backgroundColor: 'rgba(10, 26, 51, 0.4)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '10px 14px',
                      width: '100%'
                    }}
                  />
                </div>
                
                <div className="form-group description-container" style={{ margin: '0' }}>
                  <textarea 
                    id="blog-description" 
                    placeholder="Enter a short description of your blog post" 
                    className="form-control" 
                    rows={2}
                    value={blogDescription}
                    onChange={(e) => setBlogDescription(e.target.value)}
                    style={{ 
                      resize: 'vertical', 
                      minHeight: '60px',
                      backgroundColor: 'rgba(10, 26, 51, 0.4)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '10px 14px',
                      width: '100%',
                      fontSize: '14px'
                    }}
                  ></textarea>
                </div>
                
                <div className="form-group" style={{ margin: '0' }}>
                  <input 
                    type="text" 
                    id="blog-tags" 
                    placeholder="Tags (comma separated)" 
                    className="form-control"
                    value={blogTags}
                    onChange={(e) => setBlogTags(e.target.value)}
                    style={{
                      backgroundColor: 'rgba(10, 26, 51, 0.4)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '10px 14px',
                      width: '100%',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              {/* Right column - Image upload */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div className="image-upload-container" style={{ width: '100%' }}>
                  <div 
                    className="image-upload-area"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      backgroundColor: 'rgba(10, 26, 51, 0.4)',
                      display: imagePreview ? 'none' : 'flex',
                      height: '100px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '14px',
                      cursor: 'pointer',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px'
                    }}
                  >
                    <span className="upload-icon">
                      <FiImage size={24} />
                    </span>
                    <span className="upload-text" style={{ textAlign: 'center' }}>Upload cover image</span>
                    <input 
                      type="file" 
                      id="blog-image" 
                      className="file-input" 
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  {imagePreview && (
                    <div 
                      className="image-preview-container"
                      style={{
                        position: 'relative',
                        height: '100px'
                      }}
                    >
                      <div 
                        className="image-preview-thumbnail"
                        style={{
                          height: '100px',
                          width: '100%',
                          borderRadius: 'var(--border-radius)',
                          backgroundImage: `url(${imagePreview})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <button
                        onClick={() => {
                          setBlogImage(null);
                          setImagePreview('');
                          if (imagePreviewRef.current) {
                            imagePreviewRef.current.classList.remove('has-image');
                            imagePreviewRef.current.style.backgroundImage = '';
                          }
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '8px',
                          background: 'rgba(10, 26, 51, 0.7)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '16px',
                          lineHeight: '1',
                          borderRadius: '50%',
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div 
                    className="image-preview" 
                    id="image-preview"
                    ref={imagePreviewRef}
                    style={{ display: 'none' }}
                  ></div>
                </div>
                
                {/* First row of buttons - Save and Load */}
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    onClick={saveDraft} 
                    style={{
                      backgroundColor: 'rgba(10, 26, 51, 0.6)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '8px 0',
                      cursor: 'pointer',
                      fontSize: '14px',
                      flex: 1
                    }}
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    onClick={loadDraft} 
                    style={{
                      backgroundColor: 'rgba(10, 26, 51, 0.6)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '8px 0',
                      cursor: 'pointer',
                      fontSize: '14px',
                      flex: 1
                    }}
                  >
                    Load
                  </button>
                </div>
                
                {/* Second row of buttons - Delete and Publish */}
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button 
                    type="button" 
                    className="danger-button" 
                    onClick={deleteDraft} 
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--error-color)',
                      border: '1px solid var(--error-color)',
                      borderRadius: 'var(--border-radius)',
                      padding: '8px 0',
                      cursor: 'pointer',
                      fontSize: '14px',
                      flex: 1
                    }}
                  >
                    Delete
                  </button>
                  <button 
                    type="button" 
                    className="primary-button"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--border-radius)',
                      padding: '8px 0',
                      cursor: 'pointer',
                      fontWeight: '600',
                      boxShadow: 'var(--box-shadow)',
                      opacity: isPublishing ? '0.7' : '1',
                      fontSize: '14px',
                      flex: 1
                    }}
                  >
                    {isPublishing ? '...' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const insertFormat = (prefix: string, suffix: string) => {
    if (!editorRef.current) return;
    
    const textArea = editorRef.current;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = blogContent.substring(start, end);
    
    const beforeText = blogContent.substring(0, start);
    const afterText = blogContent.substring(end);
    
    // If nothing is selected, insert format markers with cursor in between
    if (start === end) {
      const newText = beforeText + prefix + suffix + afterText;
      setBlogContent(newText);
      
      // Place cursor between prefix and suffix
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + prefix.length;
        }
      }, 0);
    } else {
      // If text is selected, wrap it with format markers
      const newText = beforeText + prefix + selectedText + suffix + afterText;
      setBlogContent(newText);
      
      // Select the newly formatted text
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = start + prefix.length;
          editorRef.current.selectionEnd = start + prefix.length + selectedText.length;
        }
      }, 0);
    }
  };

  const insertList = (cursorPosition: number) => {
    const currentContent = blogContent;
    const newContent = currentContent.substring(0, cursorPosition) + 
      "\n- List item" + 
      currentContent.substring(cursorPosition);
    setBlogContent(newContent);
  };

  const saveDraft = () => {
    const draft = {
      title: blogTitle,
      description: blogDescription,
      content: blogContent,
      tags: blogTags,
      imagePreview: imagePreview,
      lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('snailsPub_draft', JSON.stringify(draft));
    alert('Draft saved successfully!');
  };
  
  const loadDraft = () => {
    const draftJson = localStorage.getItem('snailsPub_draft');
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson);
        setBlogTitle(draft.title || '');
        setBlogDescription(draft.description || '');
        setBlogContent(draft.content || '');
        setBlogTags(draft.tags || '');
        
        if (draft.imagePreview) {
          setImagePreview(draft.imagePreview);
          if (imagePreviewRef.current) {
            imagePreviewRef.current.classList.add('has-image');
            imagePreviewRef.current.style.backgroundImage = `url(${draft.imagePreview})`;
          }
        }
        
        alert('Draft loaded successfully!');
      } catch (e) {
        console.error('Failed to parse draft:', e);
        alert('Failed to load draft.');
      }
    } else {
      alert('No draft found.');
    }
  };
  
  const deleteDraft = () => {
    localStorage.removeItem('snailsPub_draft');
    alert('Draft deleted.');
  };

  // Add auto-load draft on component mount
  useEffect(() => {
    if (activeTab === 'create') {
      const draftJson = localStorage.getItem('snailsPub_draft');
      if (draftJson && (!blogTitle && !blogContent)) {
        try {
          const draft = JSON.parse(draftJson);
          const lastSaved = new Date(draft.lastSaved || 0);
          const now = new Date();
          const hoursSinceSave = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);
          
          // Only auto-load if draft is less than 24 hours old
          if (hoursSinceSave < 24) {
            if (window.confirm('We found a saved draft. Would you like to load it?')) {
              setBlogTitle(draft.title || '');
              setBlogDescription(draft.description || '');
              setBlogContent(draft.content || '');
              setBlogTags(draft.tags || '');
              
              if (draft.imagePreview) {
                setImagePreview(draft.imagePreview);
                if (imagePreviewRef.current) {
                  imagePreviewRef.current.classList.add('has-image');
                  imagePreviewRef.current.style.backgroundImage = `url(${draft.imagePreview})`;
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      }
    }
  }, [activeTab]);
  
  // Auto-save draft every 30 seconds if content exists
  useEffect(() => {
    if (activeTab === 'create' && (blogTitle.trim() || blogContent.trim())) {
      const autoSaveInterval = setInterval(() => {
        const draft = {
          title: blogTitle,
          description: blogDescription,
          content: blogContent,
          tags: blogTags,
          imagePreview: imagePreview,
          lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('snailsPub_draft', JSON.stringify(draft));
        console.log('Draft auto-saved:', new Date().toLocaleTimeString());
      }, 30000); // Auto-save every 30 seconds
      
      return () => clearInterval(autoSaveInterval);
    }
  }, [activeTab, blogTitle, blogDescription, blogContent, blogTags, imagePreview]);

  useEffect(() => {
    if (editorRef.current) {
      const adjustTextareaHeight = () => {
        const textarea = editorRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }
      };
      
      adjustTextareaHeight();
    }
  }, [blogContent]);

  return (
    <div className="snailsfeed-container" style={{ overflow: 'hidden', height: '100vh' }}>
      <div className="snailsfeed-sidebar left">
        <div className="snailsfeed-section">
          <BombHeader />
          <ProfileCard />
        </div>
      </div>
      
      <main className="snailsfeed-main" style={{ overflow: 'hidden' }}>
        <div className="feed-tabs">
          <button 
            className={`tab-button ${activeTab === 'latest' ? 'active' : ''}`}
            onClick={() => handleTabChange('latest')}
          >
            Latest
          </button>
          <button 
            className={`tab-button ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => handleTabChange('popular')}
          >
            Popular
          </button>
          <button 
            className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => handleTabChange('following')}
          >
            Following
          </button>
          <button 
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => handleTabChange('create')}
          >
            Create
          </button>
        </div>
        
        <div style={{ overflow: 'hidden', height: 'calc(100vh - 60px)' }}>
          {activeTab === 'latest' ? (
            renderLatestContent()
          ) : activeTab === 'popular' ? (
            renderPopularContent()
          ) : activeTab === 'following' ? (
            renderFollowingContent()
          ) : (
            renderCreateContent()
          )}
        </div>
      </main>
      
      {showToast && (
        <div className="image-uploaded-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
} 