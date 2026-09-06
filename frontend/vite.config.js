import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    // Les appels à l'API partent en chemin relatif (/api/...) et sont redirigés ici
    // vers le serveur de développement. Le navigateur ne voit donc qu'une seule
    // origine : aucune question de partage entre origines en développement, et aucune
    // adresse d'API à porter dans le code ni dans une variable d'environnement.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/preparation.js',
  },
});
