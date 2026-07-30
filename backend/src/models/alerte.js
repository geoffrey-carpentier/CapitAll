// Accès aux données de la table alerte. Comme partout, le cloisonnement est porté par
// le SQL : chaque requête filtre sur le propriétaire, dont l'identifiant vient du jeton.

const { query } = require('../db');

const CHAMPS = `al.id, al.utilisateur_id, al.actif_id, al.type_cible, al.sens_seuil,
                al.valeur_seuil, al.statut, al.date_creation, al.date_declenchement`;

// Jointure à gauche : une alerte sur le capital total ne cible aucun actif, elle ne
// doit pas disparaître de la liste pour autant.
async function listerParUtilisateur(utilisateurId) {
  const { rows } = await query(
    `SELECT ${CHAMPS}, a.symbole, a.nom AS nom_actif
     FROM alerte al
     LEFT JOIN actif a ON a.id = al.actif_id
     WHERE al.utilisateur_id = $1
     ORDER BY
       CASE al.statut WHEN 'declenchee' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
       al.date_declenchement DESC NULLS LAST,
       al.date_creation DESC`,
    [utilisateurId]
  );
  return rows;
}

async function listerActivesParUtilisateur(utilisateurId) {
  const { rows } = await query(
    `SELECT ${CHAMPS}, a.symbole
     FROM alerte al
     LEFT JOIN actif a ON a.id = al.actif_id
     WHERE al.utilisateur_id = $1 AND al.statut = 'active'`,
    [utilisateurId]
  );
  return rows;
}

// Création d'une alerte ciblant un actif. Même motif que les transactions du lot B :
// le SELECT qui alimente l'INSERT ne rend une ligne que si l'actif appartient au
// demandeur. Si ce n'est pas le cas, rien n'est inséré et la fonction rend null.
async function creerSurActif({ utilisateurId, actifId, sensSeuil, valeurSeuil }) {
  const { rows } = await query(
    `INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil)
     SELECT $1, a.id, 'actif', $3, $4
     FROM actif a
     WHERE a.id = $2 AND a.utilisateur_id = $1
     RETURNING id, utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil,
               statut, date_creation, date_declenchement`,
    [utilisateurId, actifId, sensSeuil, valeurSeuil]
  );
  return rows[0] || null;
}

// Alerte sur le capital total : aucun actif à contrôler, l'identifiant du propriétaire
// vient directement du jeton.
async function creerSurCapitalTotal({ utilisateurId, sensSeuil, valeurSeuil }) {
  const { rows } = await query(
    `INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil)
     VALUES ($1, NULL, 'capital_total', $2, $3)
     RETURNING id, utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil,
               statut, date_creation, date_declenchement`,
    [utilisateurId, sensSeuil, valeurSeuil]
  );
  return rows[0];
}

async function desactiver(id, utilisateurId) {
  const { rows } = await query(
    `UPDATE alerte
     SET statut = 'desactivee'
     WHERE id = $1 AND utilisateur_id = $2
     RETURNING id, utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil,
               statut, date_creation, date_declenchement`,
    [id, utilisateurId]
  );
  return rows[0] || null;
}

// Marquage groupé des alertes franchies, en une seule requête. Une boucle d'UPDATE
// ferait autant d'allers-retours que d'alertes ; ANY($2) traite le lot d'un coup.
// Le filtre sur le statut évite d'écraser une date de déclenchement déjà posée.
async function marquerDeclenchees(utilisateurId, identifiants) {
  if (identifiants.length === 0) {
    return 0;
  }

  const { rowCount } = await query(
    `UPDATE alerte
     SET statut = 'declenchee', date_declenchement = now()
     WHERE utilisateur_id = $1 AND id = ANY($2::int[]) AND statut = 'active'`,
    [utilisateurId, identifiants]
  );
  return rowCount;
}

module.exports = {
  listerParUtilisateur,
  listerActivesParUtilisateur,
  creerSurActif,
  creerSurCapitalTotal,
  desactiver,
  marquerDeclenchees,
};
