import { defineConfig } from 'vite';

// In produzione la pagina vive in https://wizy-33.github.io/movimento-spike/,
// in sviluppo alla radice di http://127.0.0.1:5173/ (entrambi registrati come redirect URI).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/movimento-spike/' : '/',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
}));
