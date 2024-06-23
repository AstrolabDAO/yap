import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import pugPlugin from 'vite-plugin-pug'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    pugPlugin()
  ],
  resolve: {
    alias: {
      '@': '/src',
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  },
  build: {
    rollupOptions: {
      external: ['react', 'react-dom']
    }
  }
})
