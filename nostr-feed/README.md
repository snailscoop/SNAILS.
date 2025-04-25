# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

# snails.tube

A Nostr-powered livestreaming platform with video playback capabilities.

## Features

- Livestreaming via Nostr protocol (NIP-53)
- Video playback for recorded content
- Dynamic content discovery
- Responsive design for desktop and mobile
- Integration with Nostr relays

## Development

To run the application in development mode:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Production Deployment

### Option 1: Using Docker (Recommended)

The easiest way to deploy snails.tube is using Docker and docker-compose:

```bash
# Build and start the container
docker-compose up -d --build
```

This will:
1. Build the React application
2. Create a production-ready Docker image
3. Serve the application via Nginx on port 80

### Option 2: Manual Build

If you prefer a manual build:

```bash
# Install dependencies
npm install

# Build the application
npm run build

# The output will be in the 'dist' directory
# Serve using your preferred web server (nginx, apache, etc.)
```

## Nostr Relay Configuration

The application connects to the following Nostr relays by default:
- wss://relay.damus.io
- wss://relay.nostr.band
- wss://nos.lol
- wss://relay.snort.social
- wss://relay.zaps.stream (important for livestreaming content)

You can configure additional relays by modifying the `LIVESTREAM_RELAYS` array in `src/App.tsx`.

## Performance Optimization

For optimal livestreaming performance:
1. Use relays that specifically support NIP-53 livestreaming
2. Consider setting up your own relay for better control and performance
3. For broadcasting, use OBS or similar software with RTMP/HLS output

## License

MIT
