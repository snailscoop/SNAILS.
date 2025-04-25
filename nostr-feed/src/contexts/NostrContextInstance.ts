import { createContext } from 'react';
import { NostrContextType } from './types';

export const NostrContext = createContext<NostrContextType | null>(null); 