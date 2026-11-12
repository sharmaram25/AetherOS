import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Production Content-Security-Policy.
 *
 * The key privacy guarantee lives in `connect-src`, `img-src` and `form-action`:
 * nothing running inside AetherOS (including sandboxed third-party apps) can
 * send data to an arbitrary server. The only external hosts allowed are the
 * model mirrors used when the user explicitly opts in to downloading an
 * on-device AI model in Cortex.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob: mediastream:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'aether-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<!--CSP-->',
      `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  server: { port: 3000, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
  },
});
