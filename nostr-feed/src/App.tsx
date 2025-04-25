import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { NostrProvider } from './contexts/NostrContext';
import { LandingPage } from './pages/LandingPage';
import { SnailsFeedPage } from './pages/SnailsFeedPage';
import { SnailsPubPage } from './pages/SnailsPubPage';
import { SnailsTubePage } from './pages/SnailsTubePage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { Header } from './components/Header';
import './App.css';

// Livestreaming-specific relays
const LIVESTREAM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.zaps.stream',
  'wss://nostr.mutinywallet.com',
  'wss://relay.nostr.bg',
  'wss://nostr.oxtr.dev',
  'wss://nostr.fmt.wiz.biz'
];

function App() {
  return (
    <ThemeProvider>
      <NostrProvider explicitRelayUrls={LIVESTREAM_RELAYS}>
        <div className="app-container">
          <Header />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/snailsfeed" element={<SnailsFeedPage />} />
            <Route path="/snailspub" element={<SnailsPubPage />} />
            <Route path="/snailstube" element={<SnailsTubePage />} />
            <Route path="/profile/:npub" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
          </Routes>
        </div>
      </NostrProvider>
    </ThemeProvider>
  );
}

export default App;
