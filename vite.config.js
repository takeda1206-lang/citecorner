import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CrossRef はCORS対応なのでフロントから直接叩く。
// NCBI eutils は production では Cloudflare Pages Functions (functions/api/ncbi/[[path]].js)
// 経由で中継する。開発サーバーでは下の proxy が同じ /api/ncbi を eutils に転送するので、
// フロント側のコードは dev / prod のどちらでも常に同一オリジンの /api/ncbi を叩けばよい。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/ncbi': {
        target: 'https://eutils.ncbi.nlm.nih.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ncbi/, '/entrez/eutils'),
      },
    },
  },
});
