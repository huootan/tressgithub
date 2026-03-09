import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tressgithub/', // 例如：如果您建立的 repository 叫 warehouse，這裡就填 '/warehouse/'
})