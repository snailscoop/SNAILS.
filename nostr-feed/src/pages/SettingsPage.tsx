import React, { useState, useEffect } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { useNavigate } from 'react-router-dom';

interface ProfileFormData {
  displayName: string;
  username: string;
  about: string;
  website: string;
  nip05: string;
  profileImage: string;
  bannerImage: string;
}

// Interface for relay information
interface RelayDetails {
  url: string;
  name?: string;
  description?: string;
  connected: boolean;
  supportedNips?: number[];
  software?: string;
  version?: string;
  loading: boolean;
  error?: string;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { isConnected, currentUser, encodePublicKey, updateProfile, saveRelays, ndk } = useNostrContext();
  
  // Profile form state
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    displayName: '',
    username: '',
    about: '',
    website: '',
    nip05: '',
    profileImage: '',
    bannerImage: ''
  });
  
  // Settings states
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Relay settings
  const [selectedRelays, setSelectedRelays] = useState<string[]>([
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nostr.wine',
    'wss://purplepag.es'
  ]);
  const [relayDetails, setRelayDetails] = useState<RelayDetails[]>([]);
  const [newRelay, setNewRelay] = useState('');
  const [isLoadingRelays, setIsLoadingRelays] = useState(false);
  
  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    shareUsageData: false,
    showReadReceipts: true,
    allowDMs: true,
    allowMentions: true,
    hideFollowingList: false,
  });
  
  // Moderation settings
  const [moderationSettings, setModerationSettings] = useState({
    muteWords: '',
    muteUsers: '',
    hideReplies: false,
    hideReposts: false,
    hideNSFW: true,
  });
  
  // Theme settings
  const [theme, setTheme] = useState('dark');
  
  // Available themes
  const themes = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'snail', name: 'Snail Theme' }
  ];

  // Load current user data into form when available
  useEffect(() => {
    if (currentUser && currentUser.profile) {
      setProfileForm({
        displayName: currentUser.profile.displayName || '',
        username: currentUser.profile.name || '',
        about: currentUser.profile.about || '',
        website: currentUser.profile.website || '',
        nip05: currentUser.profile.nip05 || '',
        profileImage: currentUser.profile.image || '',
        bannerImage: currentUser.profile.banner || ''
      });
    }
  }, [currentUser]);

  // Load relay information when active tab is relays
  useEffect(() => {
    if (activeTab === 'relays') {
      fetchRelayInfo();
    }
  }, [activeTab, selectedRelays]);

  // Fetch relay information
  const fetchRelayInfo = async () => {
    setIsLoadingRelays(true);
    
    try {
      // Get the NostrService instance from the NDK
      const nostrService = (ndk as any)._nostrService;
      
      if (!nostrService) {
        throw new Error('NostrService not available');
      }
      
      // Create new array with initial data
      const relayData: RelayDetails[] = selectedRelays.map(url => ({
        url,
        connected: false,
        loading: true
      }));
      
      // Update state immediately with loading state
      setRelayDetails(relayData);
      
      // Get connected relay status
      const relayStatus = nostrService.getRelayStatus();
      
      // Fetch detailed information for each relay
      const updatedRelayData = await Promise.all(
        selectedRelays.map(async (url) => {
          try {
            // Find connection status
            const status = relayStatus.find((rs: { url: string }) => rs.url === url);
            
            // Get relay info
            const info = await nostrService.getRelayInfo(url);
            
            return {
              url,
              name: info?.name,
              description: info?.description,
              connected: status?.connected || false,
              supportedNips: info?.supported_nips,
              software: info?.software,
              version: info?.version,
              loading: false
            };
          } catch (error) {
            console.error(`Error fetching info for ${url}:`, error);
            return {
              url,
              connected: false,
              loading: false,
              error: 'Failed to load relay information'
            };
          }
        })
      );
      
      setRelayDetails(updatedRelayData);
    } catch (error) {
      console.error('Error fetching relay information:', error);
      setErrorMessage('Failed to load relay information');
    } finally {
      setIsLoadingRelays(false);
    }
  };

  // Format NIP numbers for display
  const formatNips = (nips?: number[]) => {
    if (!nips || nips.length === 0) return 'None';
    
    if (nips.length <= 5) {
      return nips.map(n => `NIP-${n}`).join(', ');
    } else {
      const firstFive = nips.slice(0, 5).map(n => `NIP-${n}`).join(', ');
      return `${firstFive}, +${nips.length - 5} more`;
    }
  };

  // Handle theme change
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value);
    // In a real app, this would apply the theme
  };

  // Toggle relay selection
  const toggleRelay = (relay: string) => {
    if (selectedRelays.includes(relay)) {
      setSelectedRelays(selectedRelays.filter(r => r !== relay));
    } else {
      setSelectedRelays([...selectedRelays, relay]);
    }
  };
  
  // Add new relay
  const addRelay = () => {
    if (newRelay && !selectedRelays.includes(newRelay)) {
      setSelectedRelays([...selectedRelays, newRelay]);
      setNewRelay('');
    }
  };
  
  // Remove relay
  const removeRelay = (relay: string) => {
    setSelectedRelays(selectedRelays.filter(r => r !== relay));
  };
  
  // Handle profile form changes
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileForm({
      ...profileForm,
      [name]: value
    });
  };
  
  // Handle privacy setting changes
  const handlePrivacyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPrivacySettings({
      ...privacySettings,
      [name]: checked
    });
  };
  
  // Handle moderation setting changes
  const handleModerationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setModerationSettings({
      ...moderationSettings,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };
  
  // Save profile changes
  const saveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      const success = await updateProfile({
        displayName: profileForm.displayName,
        name: profileForm.username,
        about: profileForm.about,
        website: profileForm.website,
        nip05: profileForm.nip05,
        picture: profileForm.profileImage,
        banner: profileForm.bannerImage
      });
      
      if (success) {
        setSuccessMessage('Profile updated successfully!');
      } else {
        setErrorMessage('Failed to update profile. Please try again.');
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Profile update error:', error);
      setErrorMessage('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle disconnect
  const handleDisconnect = () => {
    // In a real app, this would disconnect the user
    navigate('/');
  };
  
  // Save relay settings
  const handleSaveRelays = async () => {
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      const success = await saveRelays(selectedRelays);
      
      if (success) {
        setSuccessMessage('Relay settings saved successfully!');
        fetchRelayInfo(); // Refresh relay info after saving
      } else {
        setErrorMessage('Failed to save relay settings. Please try again.');
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Relay settings error:', error);
      setErrorMessage('Failed to save relay settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Helper function to render tab content
  const renderTabContent = () => {
    if (!isConnected && activeTab !== 'appearance') {
      return (
        <div className="not-connected-message">
          <h3>Not Connected</h3>
          <p>You need to connect to Nostr to access these settings.</p>
          <p>Please return to the homepage and connect with your Nostr extension or private key.</p>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'profile':
        return (
          <div className="tab-content">
            <form onSubmit={saveProfileChanges}>
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={profileForm.displayName}
                  onChange={handleProfileChange}
                  placeholder="Your display name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={profileForm.username}
                  onChange={handleProfileChange}
                  placeholder="Your username"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="about">About</label>
                <textarea
                  id="about"
                  name="about"
                  value={profileForm.about}
                  onChange={handleProfileChange}
                  placeholder="Tell us about yourself"
                  rows={3}
                ></textarea>
              </div>
              
              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={profileForm.website}
                  onChange={handleProfileChange}
                  placeholder="https://yourwebsite.com"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="nip05">NIP-05 Identifier</label>
                <input
                  type="text"
                  id="nip05"
                  name="nip05"
                  value={profileForm.nip05}
                  onChange={handleProfileChange}
                  placeholder="you@domain.com"
                />
                <small>This helps verify your identity on Nostr</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="profileImage">Profile Image URL</label>
                <input
                  type="url"
                  id="profileImage"
                  name="profileImage"
                  value={profileForm.profileImage}
                  onChange={handleProfileChange}
                  placeholder="https://example.com/profile.jpg"
                />
                {profileForm.profileImage && (
                  <div className="image-preview">
                    <img src={profileForm.profileImage} alt="Profile preview" />
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="bannerImage">Banner Image URL</label>
                <input
                  type="url"
                  id="bannerImage"
                  name="bannerImage"
                  value={profileForm.bannerImage}
                  onChange={handleProfileChange}
                  placeholder="https://example.com/banner.jpg"
                />
                {profileForm.bannerImage && (
                  <div className="banner-preview">
                    <img src={profileForm.bannerImage} alt="Banner preview" />
                  </div>
                )}
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        );
        
      case 'relays':
        return (
          <div className="tab-content">
            <div className="relay-section">
              <h3>Connect to Relays</h3>
              <p>Select the relays you want to connect to:</p>
              
              <div className="relay-add">
                <input
                  type="url"
                  placeholder="wss://new-relay.example.com"
                  value={newRelay}
                  onChange={(e) => setNewRelay(e.target.value)}
                />
                <button className="btn primary" onClick={addRelay}>Add Relay</button>
              </div>
              
              {isLoadingRelays ? (
                <div className="loading-indicator">Loading relay information...</div>
              ) : (
                <div className="relay-list">
                  {relayDetails.map(relay => (
                    <div key={relay.url} className={`relay-item ${relay.connected ? 'connected' : 'disconnected'}`}>
                      <div className="relay-header">
                        <div className="relay-info">
                          <input
                            type="checkbox"
                            id={`relay-${relay.url}`}
                            checked={true}
                            onChange={() => toggleRelay(relay.url)}
                          />
                          <label htmlFor={`relay-${relay.url}`}>
                            <span className={`status-indicator ${relay.connected ? 'connected' : 'disconnected'}`}></span>
                            {relay.url}
                          </label>
                        </div>
                        <button className="btn danger small" onClick={() => removeRelay(relay.url)}>Remove</button>
                      </div>
                      
                      {!relay.loading && (
                        <div className="relay-details">
                          <div className="relay-detail">
                            <strong>Status:</strong> {relay.connected ? 'Connected' : 'Disconnected'}
                          </div>
                          
                          {relay.name && (
                            <div className="relay-detail">
                              <strong>Name:</strong> {relay.name}
                            </div>
                          )}
                          
                          {relay.software && (
                            <div className="relay-detail">
                              <strong>Software:</strong> {relay.software} {relay.version && `v${relay.version}`}
                            </div>
                          )}
                          
                          {relay.supportedNips && relay.supportedNips.length > 0 && (
                            <div className="relay-detail">
                              <strong>Supported NIPs:</strong> {formatNips(relay.supportedNips)}
                            </div>
                          )}
                          
                          {relay.description && (
                            <div className="relay-detail description">
                              <strong>Description:</strong> {relay.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="form-actions">
                <button className="btn primary" onClick={handleSaveRelays} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Relay Settings'}
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'privacy':
        return (
          <div className="tab-content">
            <div className="privacy-option">
              <input
                type="checkbox"
                id="shareUsageData"
                name="shareUsageData"
                checked={privacySettings.shareUsageData}
                onChange={handlePrivacyChange}
              />
              <label htmlFor="shareUsageData">Allow sharing of usage data for analytics</label>
            </div>
            
            <div className="privacy-option">
              <input
                type="checkbox"
                id="showReadReceipts"
                name="showReadReceipts"
                checked={privacySettings.showReadReceipts}
                onChange={handlePrivacyChange}
              />
              <label htmlFor="showReadReceipts">Show read receipts</label>
            </div>
            
            <div className="privacy-option">
              <input
                type="checkbox"
                id="allowDMs"
                name="allowDMs"
                checked={privacySettings.allowDMs}
                onChange={handlePrivacyChange}
              />
              <label htmlFor="allowDMs">Allow direct messages</label>
            </div>
            
            <div className="privacy-option">
              <input
                type="checkbox"
                id="allowMentions"
                name="allowMentions"
                checked={privacySettings.allowMentions}
                onChange={handlePrivacyChange}
              />
              <label htmlFor="allowMentions">Allow mentions from everyone</label>
            </div>
            
            <div className="privacy-option">
              <input
                type="checkbox"
                id="hideFollowingList"
                name="hideFollowingList"
                checked={privacySettings.hideFollowingList}
                onChange={handlePrivacyChange}
              />
              <label htmlFor="hideFollowingList">Hide my following list</label>
            </div>
            
            <div className="form-actions">
              <button className="btn primary">Save Privacy Settings</button>
            </div>
          </div>
        );
        
      case 'moderation':
        return (
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="muteWords">Muted Words</label>
              <textarea
                id="muteWords"
                name="muteWords"
                value={moderationSettings.muteWords}
                onChange={handleModerationChange}
                placeholder="Enter words to mute, separated by commas"
                rows={3}
              ></textarea>
              <small>Content containing these words will be hidden</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="muteUsers">Muted Users</label>
              <textarea
                id="muteUsers"
                name="muteUsers"
                value={moderationSettings.muteUsers}
                onChange={handleModerationChange}
                placeholder="Enter public keys or npubs to mute, separated by commas"
                rows={3}
              ></textarea>
              <small>Content from these users will be hidden</small>
            </div>
            
            <div className="moderation-option">
              <input
                type="checkbox"
                id="hideReplies"
                name="hideReplies"
                checked={moderationSettings.hideReplies}
                onChange={handleModerationChange}
              />
              <label htmlFor="hideReplies">Hide replies from users I don't follow</label>
            </div>
            
            <div className="moderation-option">
              <input
                type="checkbox"
                id="hideReposts"
                name="hideReposts"
                checked={moderationSettings.hideReposts}
                onChange={handleModerationChange}
              />
              <label htmlFor="hideReposts">Hide reposts from users I don't follow</label>
            </div>
            
            <div className="moderation-option">
              <input
                type="checkbox"
                id="hideNSFW"
                name="hideNSFW"
                checked={moderationSettings.hideNSFW}
                onChange={handleModerationChange}
              />
              <label htmlFor="hideNSFW">Hide NSFW content</label>
            </div>
            
            <div className="form-actions">
              <button className="btn primary">Save Moderation Settings</button>
            </div>
          </div>
        );
        
      case 'appearance':
        return (
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="theme-select">Theme:</label>
              <select 
                id="theme-select" 
                value={theme} 
                onChange={handleThemeChange}
                className="theme-select"
              >
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        );
        
      case 'account':
        return (
          <div className="tab-content">
            <h3>Account Information</h3>
            {currentUser && (
              <div className="account-info">
                <div className="info-row">
                  <strong>Public Key:</strong>
                  <div className="key-display">{currentUser.pubkey}</div>
                </div>
                
                <div className="info-row">
                  <strong>NPUB:</strong>
                  <div className="key-display">{encodePublicKey(currentUser.pubkey)}</div>
                </div>
                
                <div className="danger-zone">
                  <h4>Danger Zone</h4>
                  <button className="btn danger" onClick={handleDisconnect}>Disconnect Account</button>
                </div>
              </div>
            )}
          </div>
        );
        
      default:
        return <div>Select a settings category</div>;
    }
  };

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1>Settings</h1>
        {successMessage && <div className="success-message">{successMessage}</div>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>
      
      <div className="settings-layout">
        <div className="settings-sidebar">
          <div className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            Profile
          </div>
          <div className={`sidebar-item ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>
            Account
          </div>
          <div className={`sidebar-item ${activeTab === 'relays' ? 'active' : ''}`} onClick={() => setActiveTab('relays')}>
            Relays
          </div>
          <div className={`sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>
            Privacy
          </div>
          <div className={`sidebar-item ${activeTab === 'moderation' ? 'active' : ''}`} onClick={() => setActiveTab('moderation')}>
            Moderation
          </div>
          <div className={`sidebar-item ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>
            Appearance
          </div>
        </div>
        
        <div className="settings-main">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
} 