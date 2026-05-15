import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ⚠️ 重要：請將 '您的倉庫名稱' 替換為 GitHub 上的 Repository 名字 (例如 /rope-system/)
  // 如果是個人首頁 (username.github.io) 則設定為 '/'
  base: '/tressgithub/', 
})