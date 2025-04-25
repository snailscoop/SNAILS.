import { useContext } from 'react';
import { NostrContext } from './NostrContextInstance';
import { NostrContextType } from './types';

export function useNostrContext(): NostrContextType {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error('useNostrContext must be used within a NostrProvider');
  }
  return context;
}

// Re-export NostrProvider from NostrContext.tsx for compatibility
export { NostrProvider } from './NostrContext'; 