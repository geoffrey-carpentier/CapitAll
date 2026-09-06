// Accès aux demandes de réinitialisation de mot de passe.
//
// La table ne conserve que l'empreinte du jeton remis à l'utilisateur : la recherche se
// fait donc par empreinte, jamais par jeton. C'est ce qui fait qu'une base lue par un
// tiers ne donne aucun moyen de prendre la main sur un compte.

const { query } = require('../db');

// La jointure sur utilisateur rend l'état du compte avec la demande : une demande
// émise avant une désactivation ne doit pas rouvrir l'accès, et le vérifier ici évite
// une seconde requête sur un chemin déjà court.
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

// Une demande ne sert qu'une fois. La condition sur utilise_le est portée par la
// requête et non par une lecture préalable : deux appels simultanés avec le même jeton
// ne peuvent alors pas réussir tous les deux, la seconde mise à jour ne trouvant plus
// de ligne à modifier.
async function marquerUtilisee(id, executer = query) {
  const { rowCount } = await executer(
    `UPDATE reinitialisation_mot_de_passe
     SET utilise_le = now()
     WHERE id = $1 AND utilise_le IS NULL`,
    [id]
  );
  return rowCount > 0;
}

// Émettre une nouvelle demande annule les précédentes du même compte : sans cela, un
// jeton obtenu puis oublié resterait utilisable jusqu'à son expiration, et le nombre de
// clés en circulation n'aurait aucune borne.
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
