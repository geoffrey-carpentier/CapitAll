import { defineConfig } from 'vitest/config';

// Tests exécutés contre un vrai PostgreSQL, celui de docker-compose.test.yml. Ils
// vérifient ce qu'aucun modèle en mémoire ne peut établir : le verrou de ligne, la
// sérialisation de deux écritures concurrentes, et l'absence d'écriture après un refus.
//
// Les fichiers ne s'exécutent pas en parallèle : ils partagent une base et se
// disputeraient les mêmes lignes. C'est aussi ce qui rend leurs verrous mesurables —
// deux clients concurrents à l'intérieur d'un test, jamais entre deux fichiers.
export default defineConfig({
  test: {
    include: ['**/*.integration.test.js'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
