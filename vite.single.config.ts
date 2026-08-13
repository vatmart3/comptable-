/**
 * Configuration jetable : produit le site en UN SEUL fichier HTML, tout inliné
 * (JS, CSS, polices en data: URI), pour pouvoir le publier en page autonome.
 *
 * Ce n'est PAS la configuration de production — elle désactive le découpage en
 * chunks, donc la scène 3D n'est plus chargée en différé. Pour un vrai
 * hébergement, utiliser `npm run build` (vite.config.ts).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist-single',
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
