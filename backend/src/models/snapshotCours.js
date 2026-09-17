// Accès à la table snapshot_cours : l'historique du cours de chaque position.
//
// Ces données ne sont pas redondantes : un cours passé ne peut pas être recalculé, tous
// les fournisseurs n'exposant pas d'historique.
//
// Le propriétaire est vérifié dans le SQL, par jointure sur actif : l'actif d'un autre
// compte ne rend rien, comme un actif inexistant.

const { query } = require('../db');

// Cours du jour de toutes les positions, en une seule instruction.
//
// ON CONFLICT DO NOTHING s'appuie sur l'unicité (actif_id, date_snapshot) : c'est la
// base qui arbitre entre deux écritures concurrentes.
async function enregistrerSiAbsent(utilisateurId, positions) {
  const aHistoriser = positions.filter(
    (position) => position.cours_eur !== null && position.cours_eur !== undefined
  );

  if (aHistoriser.length === 0) {
    return [];
  }

  const { rows } = await query(
    `INSERT INTO snapshot_cours (actif_id, date_snapshot, cours_eur, quantite, heure_releve)
     SELECT a.id, CURRENT_DATE, entree.cours_eur, entree.quantite, now()
     FROM unnest($2::integer[], $3::numeric[], $4::numeric[])
          AS entree(actif_id, cours_eur, quantite)
     JOIN actif a ON a.id = entree.actif_id AND a.utilisateur_id = $1
     ON CONFLICT (actif_id, date_snapshot) DO NOTHING
     RETURNING actif_id`,
    [
      utilisateurId,
      aHistoriser.map((position) => position.id),
      aHistoriser.map((position) => position.cours_eur),
      aHistoriser.map((position) => position.quantite_detenue ?? '0'),
    ]
  );

  // Aucune ligne : l'historique du jour existait déjà.
  return rows;
}

// Historique d'une position, du plus ancien au plus récent.
//
// La date est formatée par PostgreSQL : rendue en DATE, le pilote la convertirait en
// instant dans le fuseau du serveur, et le JSON pourrait afficher la veille.
async function listerParActif(actifId, utilisateurId, nombreDeJours) {
  const conditionDeDate = nombreDeJours ? 'AND sc.date_snapshot >= CURRENT_DATE - $3::integer' : '';
  const parametres = nombreDeJours ? [actifId, utilisateurId, nombreDeJours] : [actifId, utilisateurId];

  const { rows } = await query(
    `SELECT to_char(sc.date_snapshot, 'YYYY-MM-DD') AS date_snapshot,
            sc.cours_eur,
            sc.quantite,
            sc.heure_releve
     FROM snapshot_cours sc
     JOIN actif a ON a.id = sc.actif_id
     WHERE sc.actif_id = $1 AND a.utilisateur_id = $2 ${conditionDeDate}
     ORDER BY sc.date_snapshot`,
    parametres
  );
  return rows;
}

// Historique récent de toutes les positions d'un utilisateur, en une requête, pour la
// colonne de tendance du tableau des positions.
async function listerRecentsParUtilisateur(utilisateurId, nombreDeJours) {
  const { rows } = await query(
    `SELECT sc.actif_id,
            to_char(sc.date_snapshot, 'YYYY-MM-DD') AS date_snapshot,
            sc.cours_eur
     FROM snapshot_cours sc
     JOIN actif a ON a.id = sc.actif_id
     WHERE a.utilisateur_id = $1
       AND sc.date_snapshot >= CURRENT_DATE - $2::integer
     ORDER BY sc.actif_id, sc.date_snapshot`,
    [utilisateurId, nombreDeJours]
  );
  return rows;
}

module.exports = { enregistrerSiAbsent, listerParActif, listerRecentsParUtilisateur };
