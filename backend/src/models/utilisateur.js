// Accès à la table utilisateur, par requêtes paramétrées.
//
// mot_de_passe_hache n'est renvoyé que par trouverParEmail et trouverAvecHachageParId,
// pour une comparaison bcrypt dans un service ; il ne doit jamais atteindre un
// contrôleur.

const { query } = require('../db');

const CHAMPS_PUBLICS = 'id, email, pseudo, role, actif, jetons_invalides_avant, date_inscription';

// role n'est jamais alimenté par une entrée utilisateur : valeur par défaut du schéma.
async function creerUtilisateur({ email, motDePasseHache, pseudo }) {
  const { rows } = await query(
    `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
     VALUES ($1, $2, $3)
     RETURNING ${CHAMPS_PUBLICS}`,
    [email, motDePasseHache, pseudo]
  );
  return rows[0];
}

// Renvoie le hachage, pour la comparaison à la connexion.
async function trouverParEmail(email) {
  const { rows } = await query(
    `SELECT ${CHAMPS_PUBLICS}, mot_de_passe_hache
     FROM utilisateur
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function trouverParId(id) {
  const { rows } = await query(
    `SELECT ${CHAMPS_PUBLICS}
     FROM utilisateur
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Renvoie le hachage à partir de l'identifiant du porteur du jeton, pour vérifier le
// mot de passe actuel (changement de mot de passe, suppression du compte).
async function trouverAvecHachageParId(id) {
  const { rows } = await query(
    `SELECT ${CHAMPS_PUBLICS}, mot_de_passe_hache
     FROM utilisateur
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Le mot de passe et la borne de révocation des jetons sont écrits dans la même requête,
// pour qu'aucun jeton antérieur ne survive au changement. La borne vient de l'horloge de
// la base.
async function mettreAJourMotDePasse(id, motDePasseHache) {
  const { rowCount } = await query(
    `UPDATE utilisateur
     SET mot_de_passe_hache = $2, jetons_invalides_avant = now()
     WHERE id = $1`,
    [id, motDePasseHache]
  );
  return rowCount > 0;
}

// État d'autorisation relu à chaque requête authentifiée, par clé primaire : c'est ce
// qui rend la révocation immédiate, sans cache.
async function trouverPourAutorisation(id) {
  const { rows } = await query(
    `SELECT id, role, actif, jetons_invalides_avant
     FROM utilisateur
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Les données liées disparaissent par les ON DELETE CASCADE du schéma.
async function supprimer(id) {
  const { rowCount } = await query('DELETE FROM utilisateur WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  creerUtilisateur,
  trouverParEmail,
  trouverParId,
  trouverAvecHachageParId,
  trouverPourAutorisation,
  mettreAJourMotDePasse,
  supprimer,
};
