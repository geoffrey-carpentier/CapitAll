// Connexion centralisée à PostgreSQL via un pool de connexions (package pg).
// Tous les modèles passent par ce module : une seule configuration, un seul pool
// réutilisé, et la garantie que les requêtes sont paramétrées (protection injection).
// L'URL de connexion vient de DATABASE_URL (voir backend/.env.example).

const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Erreur sur un client inactif du pool (coupure réseau, base redémarrée...).
// On journalise sans arrêter le process : les requêtes suivantes rouvriront un client.
// Le message seul, pour la même raison qu'au gestionnaire d'erreurs : l'objet d'erreur
// de PostgreSQL porte un champ `detail` qui recopie la valeur en cause, et un client
// inactif n'a de toute façon aucune requête en cours à situer.
pool.on('error', (erreur) => {
  console.error('Erreur inattendue sur un client PostgreSQL inactif :', erreur.message);
});

// Point d'entrée unique des requêtes. text porte les paramètres sous forme $1, $2...
// et params fournit les valeurs : jamais de concaténation de chaînes SQL.
function query(text, params) {
  return pool.query(text, params);
}

// Exécute une unité de travail sur une seule connexion du pool. Le callback reçoit
// une fonction query liée au client : toutes ses lectures et écritures voient donc le
// même état transactionnel. Le rollback est systématique dès qu'une règle métier ou
// PostgreSQL refuse l'opération.
async function executerDansTransaction(operation) {
  const client = await pool.connect();
  const queryTransactionnelle = client.query.bind(client);

  try {
    await client.query('BEGIN');
    const resultat = await operation(queryTransactionnelle);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
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

module.exports = { pool, query, executerDansTransaction, verifierConnexion };
