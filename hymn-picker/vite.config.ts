import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 這個專案是 soaring0616.github.io 的一個分頁，正式網址固定是
// https://soaring0616.github.io/hymn-picker/ ，所以 base 預設就寫死 '/hymn-picker/'：
//   - pnpm dev     → http://localhost:5173/hymn-picker/ （跟正式網址同一個子路徑）
//   - pnpm preview → 同上，預覽 dist/
//   - 真的要換路徑再用環境變數蓋掉：VITE_BASE=/ pnpm build
// base 會同時決定 import.meta.env.BASE_URL，lib/data.ts 就是靠它組 fetch 路徑。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/hymn-picker/',
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
