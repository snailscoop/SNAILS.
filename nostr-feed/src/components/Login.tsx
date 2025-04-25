import { useState } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';

export function Login() {
  const { loginWithExtension, currentUser, isLoading } = useNostrContext();
  const [error, setError] = useState<string | null>(null);

  const handleExtensionLogin = async () => {
    setError(null);
    try {
      const user = await loginWithExtension();
      if (!user) {
        setError('Failed to login with extension. Make sure you have a Nostr extension installed.');
      }
    } catch (err) {
      setError('An error occurred during login');
      console.error(err);
    }
  };

  if (currentUser) {
    return (
      <div className="user-profile">
        <h3>Logged In</h3>
        <p>Public Key: {currentUser.pubkey.slice(0, 8)}...{currentUser.pubkey.slice(-8)}</p>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h3>Login</h3>
      
      <button 
        onClick={handleExtensionLogin} 
        disabled={isLoading}
        className="login-button"
      >
        {isLoading ? 'Connecting...' : 'Login with Extension (NIP-07)'}
      </button>
      
      <p className="login-info">
        To use this app, you need a Nostr browser extension like 
        <a href="https://getalby.com/" target="_blank" rel="noopener noreferrer"> Alby</a> or 
        <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noopener noreferrer"> nos2x</a>.
      </p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
} 