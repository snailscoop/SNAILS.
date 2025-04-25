import { useNavigate } from 'react-router-dom';

export function SuggestedUsers() {
  const navigate = useNavigate();
  
  // Sample suggested users
  const suggestedUsers = [
    { id: '1', npub: 'npub1abcdef', name: 'Alice Satoshi', username: 'alice' },
    { id: '2', npub: 'npub2abcdef', name: 'Bob Lightning', username: 'bob' },
    { id: '3', npub: 'npub3abcdef', name: 'Charlie Nakamoto', username: 'charlie' }
  ];

  const handleProfileClick = (npub: string) => {
    navigate(`/profile/${npub}`);
  };

  return (
    <div className="suggested-users-container">
      <h3 className="section-title">Who to Follow</h3>
      <ul className="suggested-users-list">
        {suggestedUsers.map((user) => (
          <li key={user.id} className="suggested-user">
            <div className="suggested-user-link">
              <div 
                className="user-avatar-small" 
                onClick={() => handleProfileClick(user.npub)}
                style={{ cursor: 'pointer' }}
              >
                <div className="default-avatar small">👤</div>
              </div>
              <div className="user-info-small" onClick={() => handleProfileClick(user.npub)} style={{ cursor: 'pointer' }}>
                <div className="user-name">{user.name}</div>
                <div className="user-handle">@{user.username}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 