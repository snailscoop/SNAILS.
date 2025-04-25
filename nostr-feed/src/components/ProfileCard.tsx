import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { Login } from './Login';
import { SearchBar } from './SearchBar';

export function ProfileCard() {
  const navigate = useNavigate();
  const { currentUser, encodePublicKey, fetchProfile } = useNostrContext();
  const [copied, setCopied] = useState(false);
  
  // Fetch fresh profile data on component mount
  useEffect(() => {
    const updateProfileData = async () => {
      if (currentUser) {
        await fetchProfile(currentUser.pubkey);
      }
    };
    
    updateProfileData();
  }, [currentUser, fetchProfile]);
  
  if (!currentUser) {
    return (
      <div className="profile-card">
        <h3 className="login-status">Not Logged In</h3>
        <Login />
      </div>
    );
  }
  
  const npub = encodePublicKey(currentUser.pubkey);
  
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
  
  const navigateToSettings = () => {
    navigate('/settings');
  };
  
  return (
    <div style={{
      position: 'relative',
      padding: '1.5rem',
      borderRadius: '8px',
      margin: '0 0 1.5rem 0',
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
        backgroundImage: currentUser.profile?.banner ? `url(${currentUser.profile.banner})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.4,
        zIndex: 0
      }}></div>
      
      {/* Content container */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Profile section with centered layout */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          {/* Profile avatar */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            overflow: 'hidden',
            marginBottom: '1rem',
            backgroundColor: 'var(--secondary-color)',
            cursor: 'pointer',
            boxShadow: '0 0 8px rgba(232, 76, 60, 0.5)',
            border: '2px solid rgba(232, 76, 60, 0.3)'
          }}>
            {currentUser.profile?.image ? (
              <img 
                src={currentUser.profile.image} 
                alt={currentUser.profile?.name || 'User'}
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
                  fontSize: '2.5rem',
                  fontWeight: 'bold'
                }}
                title="Click to view profile"
              >
                {(currentUser.profile?.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Username and identifier */}
          <div style={{ textAlign: 'center' }}>
            <h2 onClick={navigateToProfile} style={{ 
              cursor: 'pointer', 
              margin: '0 0 0.5rem 0',
              fontSize: '1.4rem',
              fontWeight: 'bold',
              color: 'var(--accent-color)',
              textShadow: '0 0 5px rgba(248, 166, 92, 0.5)'
            }}>
              {currentUser.profile?.displayName || currentUser.profile?.name || npub.substring(0, 8)}
            </h2>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--light-text-color, #aaa)',
              fontSize: '0.9rem'
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
              <button 
                onClick={navigateToSettings}
                title="Account Settings"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px',
                  marginLeft: '6px',
                  color: 'var(--light-text-color, #aaa)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Search bar */}
        <div style={{ marginTop: '0.5rem' }}>
          <SearchBar />
        </div>
      </div>
    </div>
  );
} 