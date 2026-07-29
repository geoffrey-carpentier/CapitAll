// Accès aux données de la table utilisateur. Toutes les requêtes passent par le helper
// query() du pool et sont paramétrées : aucune valeur n'est concaténée dans du SQL.
//
// Règle appliquée ici : mot_de_passe_hache ne remonte jamais vers les couches
// supérieures, à la seule exception de trouverParEmail (voir son commentaire).

const { query } = require('../db');

const CHAMPS_PUBLICS = 'id, email, pseudo, role, date_inscription';

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

module.exports = { creerUtilisateur, trouverParEmail, trouverParId };
