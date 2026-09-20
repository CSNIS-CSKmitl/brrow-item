import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // กำหนดปลายทาง PocketBase database (Target URL)
  let target = env.VITE_POCKETBASE_TARGET || env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
  if (target === '/' || target === 'true') {
    target = 'http://127.0.0.1:8090';
  }

  return {
    plugins: [svelte()],
    server: {
      proxy: {
        // Proxy API requests ไปยัง PocketBase Database
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

