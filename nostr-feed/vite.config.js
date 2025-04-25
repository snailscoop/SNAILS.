import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
                configure: function (proxy, _options) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    proxy.on('proxyReq', function (proxyReq, req, _res) {
                        // Get the actual target domain from the URL query parameter
                        // Simple parsing approach
                        var url = req.url || '';
                        var queryString = url.split('?')[1] || '';
                        // Extract domain and name using simple string methods
                        var queryParts = queryString.split('&');
                        var domain = '';
                        var name = '';
                        for (var _i = 0, queryParts_1 = queryParts; _i < queryParts_1.length; _i++) {
                            var part = queryParts_1[_i];
                            if (part.startsWith('domain=')) {
                                domain = decodeURIComponent(part.substring('domain='.length));
                            }
                            else if (part.startsWith('name=')) {
                                name = decodeURIComponent(part.substring('name='.length));
                            }
                        }
                        if (domain) {
                            // Modify the request to go to the correct domain
                            proxyReq.setHeader('Host', domain);
                            proxyReq.path = "/.well-known/nostr.json?name=".concat(name);
                            // Override the proxy target dynamically
                            proxyReq.setHeader('X-Protocol', 'https:');
                            proxyReq.setHeader('X-Host', domain);
                            // Set port via options if needed
                            // proxyReq.port property doesn't exist, so we just set the path correctly
                        }
                    });
                    proxy.on('proxyRes', function (_proxyRes, _req, res) {
                        // Set CORS headers in the response
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                    });
                    // Handle proxy errors
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    proxy.on('error', function (err, _req, _res) {
                        console.error('Proxy error:', err.message);
                    });
                }
            },
            '/cdnjs/fontawesome': {
                target: 'https://cdnjs.cloudflare.com',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/cdnjs\/fontawesome/, '/ajax/libs/font-awesome'); },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                configure: function (proxy, _options) {
                    proxy.on('proxyRes', function (_proxyRes, _req, res) {
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
});
