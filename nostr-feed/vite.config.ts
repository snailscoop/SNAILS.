import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true, // Force the specified port
    host: 'localhost',
    proxy: {
      '/.well-known/nostr.json': {
        // Handle CORS for any domain requesting nostr.json
        target: 'http://localhost:3001',
        changeOrigin: true,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        configure: (proxy, _options) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Get the actual target domain from the URL query parameter
            // Simple parsing approach
            const url = req.url || '';
            const queryString = url.split('?')[1] || '';
            
            // Extract domain and name using simple string methods
            const queryParts = queryString.split('&');
            let domain = '';
            let name = '';
            
            for (const part of queryParts) {
              if (part.startsWith('domain=')) {
                domain = decodeURIComponent(part.substring('domain='.length));
              } else if (part.startsWith('name=')) {
                name = decodeURIComponent(part.substring('name='.length));
              }
            }
            
            if (domain) {
              // Modify the request to go to the correct domain
              proxyReq.setHeader('Host', domain);
              proxyReq.path = `/.well-known/nostr.json?name=${name}`;
              
              // Override the proxy target dynamically
              proxyReq.setHeader('X-Protocol', 'https:');
              proxyReq.setHeader('X-Host', domain);
              
              // Set port via options if needed
              // proxyReq.port property doesn't exist, so we just set the path correctly
            }
          });
          
          proxy.on('proxyRes', (_proxyRes, _req, res) => {
            // Set CORS headers in the response
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          });
          
          // Handle proxy errors
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          proxy.on('error', (err, _req, _res) => {
            console.error('Proxy error:', err.message);
          });
        }
      },
      '/cdnjs/fontawesome': {
        target: 'https://cdnjs.cloudflare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdnjs\/fontawesome/, '/ajax/libs/font-awesome'),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (_proxyRes, _req, res) => {
            // Set proper font headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Fix MIME type for CSS files
            if (_req.url && _req.url.endsWith('.css')) {
              res.setHeader('Content-Type', 'text/css');
            }
          });
        }
      }
    },
    cors: true
  },
  resolve: {
    alias: {
      // Add this to make NDKNip07Signer available from the main package
      '@nostr-dev-kit/ndk-nip07-signer': '@nostr-dev-kit/ndk'
    }
  }
})
