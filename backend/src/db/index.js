// Connexion centralisée à PostgreSQL via un pool de connexions (package pg).
// Tous les modèles passent par ce module : une seule configuration, un seul pool
// réutilisé, et la garantie que les requêtes sont paramétrées (protection injection).
// L'URL de connexion vient de DATABASE_URL (voir backend/.env.example).

const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Erreur sur un client inactif du pool (coupure réseau, base redémarrée...).
// On journalise sans arrêter le process : les requêtes suivantes rouvriront un client.
pool.on('error', (erreur) => {
  console.error('Erreur inattendue sur un client PostgreSQL inactif', erreur);
});

// Point d'entrée unique des requêtes. text porte les paramètres sous forme $1, $2...
// et params fournit les valeurs : jamais de concaténation de chaînes SQL.
function query(text, params) {
  return pool.query(text, params);
}

// Vérifie que la base répond, à appeler au démarrage du serveur.
async function verifierConnexion() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

module.exports = { pool, query, verifierConnexion };
