import { useState } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';

interface RecommendedUser {
  pubkey: string;
  displayName: string;
  handle: string;
  picture?: string;
  categories: string[];
}

interface CategoryData {
  name: string;
  icon: string;
  description: string;
}

export function RecommendedFollows() {
  const [activePopup, setActivePopup] = useState<string | null>(null);
  
  // Categories with their icons and descriptions
  const categories: Record<string, CategoryData> = {
    'People': { 
      name: 'People', 
      icon: '👥', 
      description: 'Popular individuals in the Nostr community'
    },
    'News': { 
      name: 'News', 
      icon: '📰', 
      description: 'Stay updated with the latest news sources'
    },
    'Politics': { 
      name: 'Politics', 
      icon: '🏛️', 
      description: 'Political commentators and discussions'
    },
    'Sports': { 
      name: 'Sports', 
      icon: '⚽', 
      description: 'Sports updates and commentary'
    },
    'Crypto': { 
      name: 'Crypto', 
      icon: '₿', 
      description: 'Cryptocurrency experts and enthusiasts'
    }
  };
  
  // This would typically come from a backend or recommendation algorithm
  // For now, we'll use static sample data with category tags
  const recommendedUsers: RecommendedUser[] = [
    {
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaef47f68',
      displayName: 'Jack',
      handle: 'jack',
      picture: 'https://nostr.build/i/nostr.build_d89baec404fd7d54e3ece27f93f9c7fc1dd5eac77c5b49ef46a67d37e2508bf5.jpeg',
      categories: ['People', 'Crypto']
    },
    {
      pubkey: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
      displayName: 'Fiatjaf',
      handle: 'fiatjaf',
      picture: 'https://nostr.build/i/nostr.build_c96eb10db581cec9c83269fda8a101b9a4a9d25dae08e1156c2e4d787fe9110c.jpeg',
      categories: ['People', 'Crypto']
    },
    {
      pubkey: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
      displayName: 'jb55',
      handle: 'jb55',
      picture: 'https://nostr.build/i/p/nostr.build_1f6ba5622139e9c3d04b5235f323cc04d59e31db27ed90bf44c4fa23adad0f62.jpeg',
      categories: ['People', 'Crypto']
    },
    {
      pubkey: 'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9',
      displayName: 'Snailfred',
      handle: 'snailfred',
      picture: 'https://nostr.build/i/nostr.build_6618de8710860406e39fb8b9ff635e333fd5c9227a8962efe7b54bd2235e2e4e.jpeg',
      categories: ['People']
    },
    {
      pubkey: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
      displayName: 'Snail Guy',
      handle: 'snailguy',
      picture: 'https://nostr.build/i/nostr.build_c9d53aabd5d0509f493d5ae14dc576711b9b20c5e77c68ad1e94c831954def7a.jpeg',
      categories: ['People']
    },
    {
      pubkey: 'npub1wxl4qz60nz447m3vas9h4lmvsyxnlkpxnr0z0xw2j7sq3uqglujs7vpm0v',
      displayName: 'Bitcoin News',
      handle: 'btcnews',
      picture: 'https://nostr.build/i/nostr.build_81bfa13dc99b0dff4ce6a150eb19a4a7a2c4a749f2198e5c0a554bc906e5e100.jpeg',
      categories: ['News', 'Crypto']
    },
    {
      pubkey: 'npub1m5wctk44dl9qmavlwch4qguyrzt4falqgrtvczqsh9yh03rywyjsxr5hp3',
      displayName: 'Sports Center',
      handle: 'sportscenter',
      picture: 'https://nostr.build/i/nostr.build_02d3d98f17f8e72238e42q1afdc5e9afd4c61365f58b3c75edcd1f6452a9e70.jpeg',
      categories: ['Sports']
    },
    {
      pubkey: 'npub1elh6va47cfj4rrnr0wevzxpj48v3xy6prspn6gwl73v7mfhxmunsucet95',
      displayName: 'Politics Daily',
      handle: 'politicsdaily',
      picture: 'https://nostr.build/i/nostr.build_3fa5a9ec0e772a4abf172f08be33292892a487d7d8c2db9b7865b7de3b0e2524.jpeg',
      categories: ['Politics', 'News']
    }
  ];

  const { currentUser } = useNostrContext();

  const handleFollow = (pubkey: string) => {
    console.log(`Following user with pubkey: ${pubkey}`);
    // In a real implementation, this would use the nostr context to follow the user
  };
  
  const togglePopup = (category: string) => {
    if (activePopup === category) {
      setActivePopup(null);
    } else {
      setActivePopup(category);
    }
  };
  
  const closeAllPopups = () => {
    setActivePopup(null);
  };

  return (
    <div className="recommended-follows">
      <div className="category-filters">
        {Object.entries(categories).map(([key, category]) => (
          <div 
            key={key} 
            className={`category-filter ${activePopup === key ? 'active' : ''}`}
            onClick={() => togglePopup(key)}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
          </div>
        ))}
      </div>
      
      {activePopup && (
        <div className="category-popup">
          <div className="popup-header">
            <h4>
              <span className="category-icon">{categories[activePopup].icon}</span>
              {categories[activePopup].name}
            </h4>
            <p className="category-description">{categories[activePopup].description}</p>
            <button className="close-popup" onClick={closeAllPopups}>×</button>
          </div>
          <div className="popup-content">
            {recommendedUsers
              .filter(user => user.categories.includes(activePopup))
              .map((user) => (
                <div key={user.pubkey} className="recommended-user">
                  <div className="user-avatar-small">
                    {user.picture ? (
                      <img 
                        src={user.picture} 
                        alt={user.displayName} 
                        style={{ backgroundColor: 'transparent' }}
                      />
                    ) : (
                      <div className="default-avatar small">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-info-small">
                    <div className="user-name">{user.displayName}</div>
                    <div className="user-handle">@{user.handle}</div>
                  </div>
                  <button 
                    className="follow-button" 
                    onClick={() => handleFollow(user.pubkey)}
                    disabled={!currentUser}
                  >
                    FOLLOW
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      
      {!activePopup && (
        <div className="all-recommended">
          {recommendedUsers.slice(0, 5).map((user) => (
            <div key={user.pubkey} className="recommended-user">
              <div className="user-avatar-small">
                {user.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.displayName} 
                    style={{ backgroundColor: 'transparent' }}
                  />
                ) : (
                  <div className="default-avatar small">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-info-small">
                <div className="user-name">{user.displayName}</div>
                <div className="user-handle">@{user.handle}</div>
              </div>
              <button 
                className="follow-button" 
                onClick={() => handleFollow(user.pubkey)}
                disabled={!currentUser}
              >
                FOLLOW
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 