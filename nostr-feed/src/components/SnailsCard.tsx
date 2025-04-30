import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { SearchBar } from './SearchBar';

interface SnailsCardProps {
  defaultNpub?: string;
}

export function SnailsCard({ defaultNpub = 'npub1aj8kwq97s04dnw4du0gelatz966xuhp57g906ndylj2r07e2ganqx6hcm4' }: SnailsCardProps) {
  const navigate = useNavigate();
  const { encodePublicKey, decodePublicKey, fetchProfile } = useNostrContext();
  const [copied, setCopied] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Use the provided npub or default one
  const npub = defaultNpub;
  const pubkey = decodePublicKey(npub);
  
  // Fetch profile data for the specified npub on component mount
  useEffect(() => {
    const loadProfileData = async () => {
      if (!pubkey) {
        setIsLoading(false);
        return;
      }
      
      try {
        const profile = await fetchProfile(pubkey);
        setProfileData(profile);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfileData();
  }, [pubkey, fetchProfile]);
  
  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Format npub to show shortened version with the npub prefix preserved
  const formatNpub = (npub: string) => {
    if (npub.length <= 14) return npub;
    const prefix = npub.startsWith('npub') ? 'npub' : '';
    const contentWithoutPrefix = npub.startsWith('npub') ? npub.slice(4) : npub;
    return `${prefix}${contentWithoutPrefix.substring(0, 4)}...${contentWithoutPrefix.substring(contentWithoutPrefix.length - 4)}`;
  };
  
  const copyNpub = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy npub:', err);
    }
  };
  
  const navigateToProfile = () => {
    navigate(`/profile/${npub}`);
  };
  
  return (
    <div style={{
      position: 'relative',
      padding: isMobile ? '1.5rem' : '2rem',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      background: 'linear-gradient(135deg, rgba(10, 26, 51, 0.8) 0%, rgba(5, 12, 23, 0.9) 100%)',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), 0 0 15px rgba(232, 76, 60, 0.4)',
      border: '1px solid rgba(232, 76, 60, 0.3)',
      overflow: 'hidden',
      transition: 'transform 0.3s, box-shadow 0.3s'
    }}>
      {/* Note card style decorative elements */}
      <div style={{
        content: '',
        position: 'absolute',
        left: 0,
        top: 0,
        width: '2px',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(232, 76, 60, 0.8) 0%, transparent 100%)',
        boxShadow: '0 0 10px rgba(232, 76, 60, 0.5)',
        zIndex: 1
      }}></div>
      
      <div style={{
        content: '',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(232, 76, 60, 0.8) 50%, transparent 100%)',
        boxShadow: '0 0 10px rgba(232, 76, 60, 0.5)',
        zIndex: 1
      }}></div>
      
      {/* Banner background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: profileData?.banner ? `url(${profileData.banner})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.4,
        zIndex: 0
      }}></div>
      
      {/* Content container */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'center' : 'flex-start',
          gap: isMobile ? '1rem' : '2rem',
          marginBottom: '1.5rem'
        }}>
          {/* Profile avatar */}
          <div style={{
            width: isMobile ? '100px' : '120px',
            height: isMobile ? '100px' : '120px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: 'var(--secondary-color)',
            cursor: 'pointer',
            boxShadow: '0 0 8px rgba(232, 76, 60, 0.5)',
            border: '2px solid rgba(232, 76, 60, 0.3)',
            flexShrink: 0
          }}>
            {isLoading ? (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(5, 12, 23, 0.7)'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
              </div>
            ) : profileData?.picture ? (
              <img 
                src={profileData.picture} 
                alt={profileData?.name || 'User'}
                onClick={navigateToProfile}
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                title="Click to view profile"
              />
            ) : (
              <div 
                className="default-avatar"
                onClick={navigateToProfile}
                style={{ 
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: isMobile ? '2.5rem' : '3rem',
                  fontWeight: 'bold'
                }}
                title="Click to view profile"
              >
                {(profileData?.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* User information */}
          <div style={{ 
            flex: 1,
            textAlign: isMobile ? 'center' : 'left'
          }}>
            <h1 onClick={navigateToProfile} style={{ 
              cursor: 'pointer', 
              margin: '0 0 0.5rem 0',
              fontSize: isMobile ? '1.8rem' : '2.2rem',
              fontWeight: 'bold',
              color: 'var(--accent-color)',
              textShadow: '0 0 5px rgba(248, 166, 92, 0.5)'
            }}>
              {isLoading ? 'Loading...' : (profileData?.displayName || profileData?.name || 'SNAILS.feed')}
            </h1>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: isMobile ? 'center' : 'flex-start',
              color: 'var(--light-text-color, #aaa)',
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}>
              {formatNpub(npub)}
              <button 
                onClick={copyNpub}
                title="Copy full npub to clipboard"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px',
                  marginLeft: '4px',
                  color: copied ? 'var(--success-color, #4CAF50)' : 'var(--light-text-color, #aaa)'
                }}
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>
            </div>
            
            <div style={{
              marginTop: '0.75rem',
              fontSize: '0.95rem',
              color: 'var(--light-text-color, #ddd)',
              maxHeight: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}>
              {isLoading ? 'Loading profile information...' : (profileData?.about || 'A decentralized social network built on the Nostr protocol')}
            </div>
          </div>
        </div>
        
        {/* Network info */}
        <div style={{
          marginTop: '1.5rem',
          padding: '0.75rem 1rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.5rem' : '0',
          justifyContent: isMobile ? 'center' : 'space-between',
          alignItems: isMobile ? 'center' : 'flex-start',
          color: 'var(--light-text-color, #ccc)',
          fontSize: '0.9rem'
        }}>
          <div>
            <strong>Network:</strong> Nostr
          </div>
          <div>
            <strong>Version:</strong> v1.0
          </div>
          <div>
            <strong>Status:</strong> <span style={{ color: '#4cd964' }}>Connected</span>
          </div>
        </div>
        
        {/* Search bar */}
        <div style={{ marginTop: '1.5rem' }}>
          <SearchBar />
        </div>
      </div>
    </div>
  );
} 