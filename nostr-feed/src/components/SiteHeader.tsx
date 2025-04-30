import React from 'react';

export function SiteHeader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '1.5rem',
      width: '100%'
    }}>
      <img 
        src="/pepe.png" 
        alt="SNAILS.feed" 
        style={{ 
          width: '80%',
          maxWidth: '200px',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 8px rgba(210, 180, 140, 0.8))'
        }} 
      />
    </div>
  );
} 