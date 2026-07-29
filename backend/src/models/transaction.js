// Accès aux données de la table transaction.
//
// La table ne porte pas de colonne utilisateur_id : c'est actif qui référence le
// propriétaire, et transaction référence actif. Le cloisonnement passe donc par une
// jointure sur actif à l'intérieur de la même requête. Ajouter un utilisateur_id à
// transaction aurait simplifié l'écriture au prix d'une dénormalisation du modèle,
// avec le risque d'incohérence que cela suppose : la jointure est préférée.

const { query } = require('../db');

const CHAMPS = 't.id, t.actif_id, t.sens, t.quantite, t.prix_unitaire, t.frais, t.date_transaction, t.note';

async function listerParActifEtUtilisateur(actifId, utilisateurId) {
  const { rows } = await query(
    `SELECT ${CHAMPS}
     FROM transaction t
     JOIN actif a ON a.id = t.actif_id
     WHERE t.actif_id = $1 AND a.utilisateur_id = $2
     ORDER BY t.date_transaction DESC, t.id DESC`,
    [actifId, utilisateurId]
  );
  return rows;
}

// L'insertion est filtrée de la même façon : le SELECT qui alimente l'INSERT ne rend
// une ligne que si l'actif appartient bien au demandeur. Si ce n'est pas le cas,
// aucune ligne n'est insérée et la fonction rend null.
async function creer({ actifId, utilisateurId, sens, quantite, prixUnitaire, frais, dateTransaction, note }) {
  const { rows } = await query(
    `INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, date_transaction, note)
     SELECT a.id, $3, $4, $5, $6, $7, $8
     FROM actif a
     WHERE a.id = $1 AND a.utilisateur_id = $2
     RETURNING id, actif_id, sens, quantite, prix_unitaire, frais, date_transaction, note`,
    [actifId, utilisateurId, sens, quantite, prixUnitaire, frais, dateTransaction, note ?? null]
  );
  return rows[0] || null;
}

async function supprimer(id, actifId, utilisateurId) {
  const { rowCount } = await query(
    `DELETE FROM transaction t
     USING actif a
     WHERE t.actif_id = a.id
       AND t.id = $1
       AND t.actif_id = $2
       AND a.utilisateur_id = $3`,
    [id, actifId, utilisateurId]
  );
  return rowCount > 0;
}

module.exports = { listerParActifEtUtilisateur, creer, supprimer };
