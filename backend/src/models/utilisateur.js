// Accès aux données de la table utilisateur. Toutes les requêtes passent par le helper
// query() du pool et sont paramétrées : aucune valeur n'est concaténée dans du SQL.
//
// Règle appliquée ici : mot_de_passe_hache ne remonte jamais vers les couches
// supérieures, à deux exceptions près, trouverParEmail et trouverAvecHachageParId
// (voir leurs commentaires). Toutes deux servent une comparaison bcrypt, jamais un
// affichage, et leur résultat ne quitte pas le service qui les appelle.

const { query } = require('../db');

const CHAMPS_PUBLICS = 'id, email, pseudo, role, actif, date_inscription';

// La colonne role n'est jamais alimentée depuis une entrée utilisateur (D23) :
// elle prend la valeur par défaut du schéma, donc 'utilisateur'.
async function creerUtilisateur({ email, motDePasseHache, pseudo }) {
  const { rows } = await query(
    `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
     VALUES ($1, $2, $3)
     RETURNING ${CHAMPS_PUBLICS}`,
    [email, motDePasseHache, pseudo]
  );
  return rows[0];
}

// Seule fonction à renvoyer le hachage : la connexion en a besoin pour le comparer.
// Elle n'est appelée que par le service d'authentification, et son résultat ne doit
// jamais être transmis tel quel à un contrôleur.
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

// Seconde et dernière fonction à renvoyer le hachage. Le changement de mot de passe
// doit comparer l'ancien mot de passe alors qu'il ne connaît que le porteur du jeton :
// il dispose de l'identifiant, pas de l'email, d'où cette variante de trouverParEmail.
async function trouverAvecHachageParId(id) {
  const { rows } = await query(
    `SELECT ${CHAMPS_PUBLICS}, mot_de_passe_hache
     FROM utilisateur
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function mettreAJourMotDePasse(id, motDePasseHache) {
  const { rowCount } = await query(
    `UPDATE utilisateur
     SET mot_de_passe_hache = $2
     WHERE id = $1`,
    [id, motDePasseHache]
  );
  return rowCount > 0;
}

// La suppression s'arrête à cette ligne : actif, alerte et snapshot_valorisation
// référencent utilisateur en ON DELETE CASCADE, et transaction comme snapshot_cours
// cascadent à leur tour depuis actif. Supprimer table par table dupliquerait une règle
// que le schéma porte déjà, avec le risque d'en oublier une à la prochaine table ajoutée.
async function supprimer(id) {
  const { rowCount } = await query('DELETE FROM utilisateur WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  creerUtilisateur,
  trouverParEmail,
  trouverParId,
  trouverAvecHachageParId,
  mettreAJourMotDePasse,
  supprimer,
};
