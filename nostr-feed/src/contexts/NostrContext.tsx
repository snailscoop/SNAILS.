import { ReactNode } from 'react';
import { useNostr } from '../hooks/useNostr';
import { NostrContext } from './NostrContextInstance';

interface NostrProviderProps {
  children: ReactNode;
  explicitRelayUrls?: string[];
}

export function NostrProvider({ children, explicitRelayUrls }: NostrProviderProps) {
  const nostr = useNostr(explicitRelayUrls);

  return (
    <NostrContext.Provider value={nostr}>
      {children}
    </NostrContext.Provider>
  );
} 