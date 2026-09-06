import { defineConfig, configDefaults } from 'vitest/config';

// Suite ordinaire : elle s'exécute sans base ni réseau, sur n'importe quel poste et en
// intégration continue. Les tests qui exigent un vrai PostgreSQL en sont exclus par
// leur nom, et non par un `skip` conditionnel : un test passé sous silence parce qu'une
// variable d'environnement manque finit par ne plus jamais s'exécuter, sans que rien ne
// le signale. Ils ont leur propre commande, `npm run test:integration`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.js'],
  },
});
