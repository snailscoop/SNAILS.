import { useLocation } from 'react-router-dom';

type LogoConfig = {
  imageSrc: string;
  altText: string;
  siteText: string;
};

const SITE_CONFIGS: Record<string, LogoConfig> = {
  feed: {
    imageSrc: '/snail.svg',
    altText: 'Snail',
    siteText: 'SNAILS.feed'
  },
  pub: {
    imageSrc: '/bomb.png',
    altText: 'Bomb',
    siteText: 'SNAILS.pub'
  },
  tube: {
    imageSrc: '/charged.png',
    altText: 'Charged',
    siteText: 'SNAILS.tube'
  },
  // Default fallback
  default: {
    imageSrc: '/Logo.png',
    altText: 'SNAILS Logo',
    siteText: 'SNAILS'
  }
};

export function SiteLogo() {
  const location = useLocation();
  
  // Determine which logo config to use based on the current path
  const getSiteConfig = (): LogoConfig => {
    const { pathname } = location;
    
    if (pathname.includes('feed')) {
      return SITE_CONFIGS.feed;
    } else if (pathname.includes('pub')) {
      return SITE_CONFIGS.pub;
    } else if (pathname.includes('tube')) {
      return SITE_CONFIGS.tube;
    }
    
    // If we can't determine the site from the URL, use the hostname
    const hostname = window.location.hostname;
    if (hostname.includes('feed')) {
      return SITE_CONFIGS.feed;
    } else if (hostname.includes('pub')) {
      return SITE_CONFIGS.pub;
    } else if (hostname.includes('tube')) {
      return SITE_CONFIGS.tube;
    }
    
    return SITE_CONFIGS.default;
  };
  
  const config = getSiteConfig();
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '1.5rem'
    }}>
      <img 
        src={config.imageSrc} 
        alt={config.altText} 
        style={{
          width: '100px',
          height: 'auto',
          marginBottom: '0.5rem'
        }}
      />
      <div style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: 'var(--accent-color)',
        textShadow: '0 0 5px rgba(248, 166, 92, 0.5)'
      }}>
        {config.siteText}
      </div>
    </div>
  );
} 