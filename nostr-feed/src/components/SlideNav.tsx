import { Link } from 'react-router-dom';
import { useNostrContext } from '../contexts/useNostrContext';
import { ProfileCard } from './ProfileCard';

interface SlideNavProps {
  isOpen: boolean;
  toggleNav: () => void;
}

export function SlideNav({ isOpen, toggleNav }: SlideNavProps) {
  const { currentUser, encodePublicKey } = useNostrContext();
  
  return (
    <>
      <div className={`slide-nav-overlay ${isOpen ? 'active' : ''}`} onClick={toggleNav}></div>
      <div className={`slide-nav ${isOpen ? 'open' : ''}`}>
        <div className="slide-nav-header">
          <div className="nav-logo-container">
            <div className="nav-logo">
              <img 
                src="/Logo.png" 
                alt="SNAILS Logo"
                style={{ 
                  height: '64px', 
                  width: 'auto', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 8px rgba(231, 76, 60, 0.8))'
                }} 
              />
            </div>
            <div className="nav-tagline">The Creator Co-Op</div>
          </div>
          <button className="close-nav" onClick={toggleNav}>×</button>
        </div>
        
        <nav className="slide-nav-menu">
          <Link to="/" className="nav-item" onClick={toggleNav}>
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Home</span>
          </Link>
          <Link to="/snailsfeed" className="nav-item" onClick={toggleNav}>
            <span className="nav-icon">
              <img 
                src="/pepe.png" 
                alt="SNAILS.feed" 
                style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
              />
            </span>
            <span className="nav-text">SNAILS.feed</span>
          </Link>
          <Link to="/snailspub" className="nav-item" onClick={toggleNav}>
            <span className="nav-icon">
              <img 
                src="/bomb.png" 
                alt="SNAILS.pub" 
                style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
              />
            </span>
            <span className="nav-text">SNAILS.pub</span>
          </Link>
          <Link to="/snailstube" className="nav-item" onClick={toggleNav}>
            <span className="nav-icon">
              <img 
                src="/charged.png" 
                alt="SNAILS.tube" 
                style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
              />
            </span>
            <span className="nav-text">SNAILS.tube</span>
          </Link>
          {currentUser && (
            <Link 
              to={`/profile/${encodePublicKey(currentUser.pubkey)}`} 
              className="nav-item"
              onClick={toggleNav}
            >
              <span className="nav-icon">👤</span>
              <span className="nav-text">My Profile</span>
            </Link>
          )}
        </nav>
        
        <div style={{ flexGrow: 1 }}></div>
        
        <div className="slide-nav-profile" style={{ marginTop: 'auto' }}>
          <ProfileCard />
        </div>
      </div>
    </>
  );
} 