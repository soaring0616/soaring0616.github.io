import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages 會把網站放在 https://<user>.github.io/<repo>/ 這種「子路徑」底下，
// 所以 build 時要告訴 Vite 資源的前綴 (base)。
//   - 本機開發 / 部署在網域根目錄 → VITE_BASE 不設，預設 '/'
//   - 部署到 repo 子路徑         → VITE_BASE=/hymn-picker/ pnpm build
// base 會同時決定 import.meta.env.BASE_URL，lib/data.ts 就是靠它組 fetch 路徑。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
