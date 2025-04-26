import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Feed } from '../components/Feed';
import { useNostrContext } from '../contexts/useNostrContext';
import { Profile } from '../db';

// Static cache for profile data
const profileCache = new Map<string, {
  profile: Profile | null;
  pubkey: string;
  followingCount: number;
}>();

export function ProfilePage() {
  const { npub } = useParams<{ npub: string }>();
  const navigate = useNavigate();
  const { isConnected, isLoading, fetchProfile, decodePublicKey, currentUser, encodePublicKey, followUser, unfollowUser, fetchContactList, getFollowing } = useNostrContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const initialLoadDone = useRef(false);

  // Use useMemo for feed filter to prevent unnecessary re-renders
  const feedFilter = useMemo(() => {
    return pubkey ? { authors: [pubkey] } : {};
  }, [pubkey]);

  useEffect(() => {
    if (!npub || (initialLoadDone.current && profileCache.has(npub))) {
      return;
    }

    const loadProfile = async () => {
      // Check if we have cached profile data
      if (profileCache.has(npub)) {
        const cachedData = profileCache.get(npub)!;
        setProfile(cachedData.profile);
        setPubkey(cachedData.pubkey);
        setFollowingCount(cachedData.followingCount);
        setLoading(false);
        
        // Check if we're following this user
        if (currentUser) {
          try {
            const contactList = await fetchContactList();
            const isFollowing = contactList.includes(cachedData.pubkey);
            setFollowing(isFollowing);
            setFollowerCount(isFollowing ? 1 : 0);
          } catch (error) {
            console.error('Failed to check following status:', error);
          }
        }
        
        return;
      }
      
      setLoading(true);
      try {
        // Check if this is the current user's profile
        const isCurrentUser = currentUser && encodePublicKey(currentUser.pubkey) === npub;
        
        // Decode the npub to get the pubkey
        const decodedPubkey = isCurrentUser ? currentUser.pubkey : decodePublicKey(npub);
        
        if (decodedPubkey) {
          setPubkey(decodedPubkey);
          
          // Fetch profile data
          const profileData = await fetchProfile(decodedPubkey);
          setProfile(profileData);
          
          // Check if we're already following this user
          if (currentUser && !isCurrentUser) {
            const contactList = await fetchContactList();
            const isFollowing = contactList.includes(decodedPubkey);
            setFollowing(isFollowing);
            
            // If we're following them, count as one follower
            if (isFollowing) {
              setFollowerCount(1);
            }
          }
          
          // Fetch following count
          const following = await getFollowing(decodedPubkey);
          setFollowingCount(following.length);
          
          // Cache the profile data
          profileCache.set(npub, {
            profile: profileData,
            pubkey: decodedPubkey,
            followingCount: following.length
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    loadProfile();
  }, [npub, currentUser, decodePublicKey, encodePublicKey, fetchContactList, fetchProfile, getFollowing]);

  const handleFollow = async () => {
    if (!pubkey || !currentUser) return;
    
    setFollowLoading(true);
    try {
      if (following) {
        // Unfollow action
        const success = await unfollowUser(pubkey);
        if (success) {
          setFollowing(false);
          // Update follower count
          setFollowerCount(0);
        }
      } else {
        // Follow action
        const success = await followUser(pubkey);
        if (success) {
          setFollowing(true);
          // Update follower count
          setFollowerCount(1);
        }
      }
    } catch (error) {
      console.error('Failed to follow/unfollow user:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Apply fixed layout styles specific to profile page
  useEffect(() => {
    // Add the fixed header class to the body when component mounts
    document.body.classList.add('profile-page-fixed-header');
    
    // Remove the class when component unmounts
    return () => {
      document.body.classList.remove('profile-page-fixed-header');
    };
  }, []);

  return (
    <div className="profile-page-container cyber-theme profile-fixed-layout">
      <div className="profile-fixed-header">
        <div className="profile-header cyber-profile-header">
          {/* Full-width banner */}
          <div className="profile-banner cyber-banner">
            {profile?.banner ? (
              <img src={profile.banner} alt="Profile banner" />
            ) : (
              <div className="default-banner"></div>
            )}
          </div>
          
          {/* Action buttons below banner */}
          <div className="cyber-buttons-container">
            <div className="profile-actions">
              <div className="profile-actions-left">
                <button className="action-button cyber-button red-button">
                  <span className="button-stat">{followingCount}</span> Following
                </button>
                <button className="action-button cyber-button red-button">
                  <span className="button-stat">{followerCount}</span> Followers
                </button>
              </div>
              <div className="profile-actions-right">
                <button 
                  className={`action-button cyber-button red-button ${following ? 'following' : ''}`}
                  onClick={handleFollow}
                  disabled={followLoading || !currentUser}
                >
                  {followLoading ? (
                    <span className="button-spinner"></span>
                  ) : following ? (
                    <span><span className="button-stat"></span>Unfollow</span>
                  ) : (
                    <span><span className="button-stat"></span>Follow</span>
                  )}
                </button>
                <button 
                  onClick={() => navigate(`/messages/${pubkey}`)} 
                  className="action-button cyber-button red-button"
                >
                  <span className="button-stat"></span>Message
                </button>
              </div>
            </div>
          </div>
          
          {/* Profile avatar positioned over the banner */}
          <div className="cyber-avatar-container centered">
            <div className="profile-avatar cyber-avatar">
              {profile?.picture ? (
                <img src={profile.picture} alt={profile.name || 'User'} />
              ) : (
                <div className="default-avatar large cyber-default-avatar"></div>
              )}
            </div>
          </div>
          
          {/* Profile content below banner */}
          <div className="cyber-profile-content">
            {/* Profile details */}
            <div className="cyber-profile-details">
              <div className="cyber-name-container">
                <h2 className="cyber-username">
                  {profile?.displayName || profile?.name || 'Anonymous'}
                  {profile?.nip05 && (
                    <span className="profile-nip05 cyber-verified">
                      <span className="verified-badge">✓</span>
                    </span>
                  )}
                </h2>
              </div>
              
              {profile?.about && (
                <p className="profile-about cyber-about">{profile.about}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="profile-tabs cyber-tabs">
          <button className="tab-button active cyber-tab-active">Notes</button>
          <button className="tab-button cyber-tab">Replies</button>
          <button className="tab-button cyber-tab">Media</button>
          <button className="tab-button cyber-tab">Likes</button>
        </div>
      </div>
      
      <main className="profile-scrollable-content">
        {loading ? (
          <div className="loading-container cyber-loading">
            <div className="cyber-spinner"></div>
            <p>Loading profile...</p>
          </div>
        ) : pubkey ? (
          <>
            {/* Feed content with key to ensure single subscription */}
            {isLoading && !isConnected ? (
              <div className="loading-container cyber-loading">
                <div className="cyber-spinner"></div>
                <p>Connecting to Nostr network...</p>
              </div>
            ) : (
              <div className="profile-feed-container">
                <Feed 
                  key={`feed-${npub}`}
                  filter={feedFilter}
                  limit={20} 
                />
              </div>
            )}
          </>
        ) : (
          <div className="error-container cyber-error">
            <h2>Profile Not Found</h2>
            <p>Could not find a profile with the provided npub.</p>
            <Link to="/" className="back-link cyber-link">Back to Home</Link>
          </div>
        )}
      </main>
    </div>
  );
} 