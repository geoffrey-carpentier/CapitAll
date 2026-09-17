// Accès aux demandes de réinitialisation de mot de passe. Seule l'empreinte du jeton est
// stockée : une base lue par un tiers ne permet pas de prendre la main sur un compte.

const { query } = require('../db');

// La jointure rend aussi l'état du compte : une demande antérieure à une désactivation
// ne doit pas rouvrir l'accès.
const CHAMPS =
  'r.id, r.utilisateur_id, r.expire_le, r.utilise_le, u.actif, u.email';

async function creer({ utilisateurId, jetonHache, expireLe }, executer = query) {
  const { rows } = await executer(
    `INSERT INTO reinitialisation_mot_de_passe (utilisateur_id, jeton_hache, expire_le)
     VALUES ($1, $2, $3)
     RETURNING id, utilisateur_id, expire_le`,
    [utilisateurId, jetonHache, expireLe]
  );
  return rows[0];
}

async function trouverParEmpreinte(jetonHache, executer = query) {
  const { rows } = await executer(
    `SELECT ${CHAMPS}
     FROM reinitialisation_mot_de_passe r
     JOIN utilisateur u ON u.id = r.utilisateur_id
     WHERE r.jeton_hache = $1`,
    [jetonHache]
  );
  return rows[0] || null;
}

// Usage unique : la condition sur utilise_le est dans la requête, si bien que deux appels
// simultanés ne peuvent pas réussir tous les deux.
async function marquerUtilisee(id, executer = query) {
  const { rowCount } = await executer(
    `UPDATE reinitialisation_mot_de_passe
     SET utilise_le = now()
     WHERE id = $1 AND utilise_le IS NULL`,
    [id]
  );
  return rowCount > 0;
}

// Une nouvelle demande annule les précédentes du même compte.
async function invaliderPour(utilisateurId, executer = query) {
  const { rowCount } = await executer(
    `UPDATE reinitialisation_mot_de_passe
     SET utilise_le = now()
     WHERE utilisateur_id = $1 AND utilise_le IS NULL`,
    [utilisateurId]
  );
  return rowCount;
}

module.exports = { creer, trouverParEmpreinte, marquerUtilisee, invaliderPour };
