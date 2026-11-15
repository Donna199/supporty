// Vite build setup: two pages (game screen + phone controller), LAN access so a phone
// on the same Wi-Fi can open the controller page, and the GitHub Pages base path.
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

// Finds this laptop's Wi-Fi address so the QR code works when you open the game on localhost.
function lanIp() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// Production builds live at https://<user>.github.io/supporty/ (GitHub Pages), so assets need that base path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/supporty/' : '/',
  server: { host: true, port: 5280, strictPort: true },
  preview: { host: true, port: 4173 },
  define: { __LAN_IP__: JSON.stringify(lanIp()) },
  build: {
    chunkSizeWarningLimit: 1500, // Three.js alone is ~500 kB; that is fine for this game
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        controller: resolve(import.meta.dirname, 'controller.html'),
      },
    },
  },
}));
