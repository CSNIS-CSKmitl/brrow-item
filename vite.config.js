import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';
import { completeOidc } from './server/oidc-complete.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // กำหนดปลายทาง PocketBase database (Target URL)
  let target = env.VITE_POCKETBASE_TARGET || env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
  if (target === '/' || target === 'true') {
    target = 'http://127.0.0.1:8090';
  }

  return {
    plugins: [
      svelte(),
      {
        name: 'oidc-completion-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/auth/oidc/complete', (req, res) => completeOidc(req, res, { ...env, ...process.env }));
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/auth/oidc/complete', (req, res) => completeOidc(req, res, { ...env, ...process.env }));
        }
      }
    ],
    preview: {
      host: true,
      port: 4173,
      allowedHosts: ['req.cskmitl.com']
    },
    server: {
      proxy: {
        // Route the app's PocketBase base path to the private database host.
        '/api/db': {
          target,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/api\/db/, '') || '/'
        },
        // Keep the root API proxy for other PocketBase paths used in development.
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
          ws: true
        },
        // Proxy Admin UI & static assets ของ PocketBase
        '/_': {
          target: target,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});

