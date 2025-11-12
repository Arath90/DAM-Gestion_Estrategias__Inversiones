import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// We load rollup-plugin-visualizer dynamically and optionally so that
// the dev server doesn't fail if the package isn't installed.
export default defineConfig(async ({ mode }) => {
  let visualizerPlugin = null
  try {
    // Dynamic import avoids hard dependency during dev if the package is not installed
    const mod = await import('rollup-plugin-visualizer')
    visualizerPlugin = (mod && (mod.visualizer || mod.default)) || null
  } catch (e) {
    // plugin not installed — that's fine, we continue without it
    // console.info('rollup-plugin-visualizer not installed; skipping bundle analysis')
  }

  const plugins = [react()]
  if (visualizerPlugin) {
    plugins.push(visualizerPlugin({ filename: 'dist/stats.html', open: false }))
  }

  return {
    plugins,
    build: {
      target: 'es2017',
      minify: 'esbuild',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lightweight-charts') || id.includes('@ui5')) return 'charts-ui5'
              return 'vendor'
            }
          }
        }
      }
    }
  }
})
