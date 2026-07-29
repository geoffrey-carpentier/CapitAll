// Accès à la table snapshot_valorisation : l'historique de la valeur du portefeuille.
//
// Un snapshot déroge volontairement à la règle « aucune valeur dérivée n'est stockée »
// (D8, D16). La distinction tient à la reconstituabilité : le PRU se recalcule à tout
// moment depuis les transactions, alors que la valeur du portefeuille au 12 mars ne se
// retrouve plus une fois la journée passée, faute de conserver les cours historiques.
// Un snapshot est donc un fait daté, pas une donnée redondante.

const { query } = require('../db');

// Écriture du snapshot du jour, en une seule requête.
//
// ON CONFLICT DO NOTHING s'appuie sur la contrainte d'unicité (utilisateur_id,
// date_snapshot) du schéma. Un SELECT suivi d'un INSERT laisserait une fenêtre entre
// les deux : deux onglets ouverts simultanément passeraient tous deux le contrôle
// d'existence et la seconde insertion échouerait. Ici, c'est la base qui arbitre.
async function enregistrerSiAbsent(utilisateurId, valeurTotaleEur) {
  const { rows } = await query(
    `INSERT INTO snapshot_valorisation (utilisateur_id, date_snapshot, valeur_totale_eur)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (utilisateur_id, date_snapshot) DO NOTHING
     RETURNING id, to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur`,
    [utilisateurId, valeurTotaleEur]
  );

  // Aucune ligne rendue signifie qu'un snapshot existait déjà pour aujourd'hui :
  // ce n'est pas une erreur, c'est le cas courant à partir du second chargement.
  return rows[0] || null;
}

// Historique trié du plus ancien au plus récent, pour être tracé tel quel.
//
// La date est formatée en chaîne par PostgreSQL plutôt que rendue comme colonne DATE :
// le pilote la convertirait sinon en objet Date interprété dans le fuseau du serveur,
// et la sérialisation JSON afficherait la veille pour tout fuseau à l'est de Greenwich.
// Une date de snapshot est un jour calendaire, pas un instant.
async function listerParUtilisateur(utilisateurId, nombreDeJours) {
  if (nombreDeJours) {
    const { rows } = await query(
      `SELECT to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur
       FROM snapshot_valorisation
       WHERE utilisateur_id = $1
         AND date_snapshot >= CURRENT_DATE - $2::integer
       ORDER BY date_snapshot`,
      [utilisateurId, nombreDeJours]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur
     FROM snapshot_valorisation
     WHERE utilisateur_id = $1
     ORDER BY date_snapshot`,
    [utilisateurId]
  );
  return rows;
}

module.exports = { enregistrerSiAbsent, listerParUtilisateur };
