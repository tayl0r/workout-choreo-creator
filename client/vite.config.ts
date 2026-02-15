import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const logger = createLogger();
const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const originalInfo = logger.info;
const originalWarn = logger.warn;
const originalError = logger.error;
logger.info = (msg, opts) => originalInfo.call(logger, `[${timestamp()}] ${msg}`, opts);
logger.warn = (msg, opts) => originalWarn.call(logger, `[${timestamp()}] ${msg}`, opts);
logger.error = (msg, opts) => originalError.call(logger, `[${timestamp()}] ${msg}`, opts);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  customLogger: logger,
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
