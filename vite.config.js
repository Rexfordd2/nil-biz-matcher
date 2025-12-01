import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: process.env.VERCEL === '1' ? '/' : '/nil-biz-matcher/',
    plugins: [react()],
    server: {
        port: 5173
    }
});
