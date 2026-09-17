// Accès à la table snapshot_valorisation : l'historique de la valeur du portefeuille.
//
// Exception assumée à la règle « aucune valeur dérivée stockée » : le PRU se recalcule
// depuis les transactions, mais la valeur d'un jour passé ne se retrouve plus sans les
// cours de ce jour-là.

const { query } = require('../db');

// Snapshot du jour en une requête. ON CONFLICT DO NOTHING s'appuie sur l'unicité
// (utilisateur_id, date_snapshot) : contrairement à un SELECT puis INSERT, deux
// écritures concurrentes ne peuvent pas échouer.
async function enregistrerSiAbsent(utilisateurId, valeurTotaleEur) {
  const { rows } = await query(
    `INSERT INTO snapshot_valorisation (utilisateur_id, date_snapshot, valeur_totale_eur, heure_releve)
     VALUES ($1, CURRENT_DATE, $2, now())
     ON CONFLICT (utilisateur_id, date_snapshot) DO NOTHING
     RETURNING id, to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur,
               heure_releve`,
    [utilisateurId, valeurTotaleEur]
  );

  // Aucune ligne : le snapshot du jour existait déjà.
  return rows[0] || null;
}

// Historique du plus ancien au plus récent.
//
// La date est formatée par PostgreSQL : rendue en DATE, le pilote la convertirait en
// instant dans le fuseau du serveur, et le JSON pourrait afficher la veille.
// heure_releve, un instant, vaut null pour les points antérieurs à cette colonne.
async function listerParUtilisateur(utilisateurId, nombreDeJours) {
  if (nombreDeJours) {
    const { rows } = await query(
      `SELECT to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur,
              heure_releve
       FROM snapshot_valorisation
       WHERE utilisateur_id = $1
         AND date_snapshot >= CURRENT_DATE - $2::integer
       ORDER BY date_snapshot`,
      [utilisateurId, nombreDeJours]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT to_char(date_snapshot, 'YYYY-MM-DD') AS date_snapshot, valeur_totale_eur,
            heure_releve
     FROM snapshot_valorisation
     WHERE utilisateur_id = $1
     ORDER BY date_snapshot`,
    [utilisateurId]
  );
  return rows;
}

module.exports = { enregistrerSiAbsent, listerParUtilisateur };
