// Accès aux données de la table utilisateur. Toutes les requêtes passent par le helper
// query() du pool et sont paramétrées : aucune valeur n'est concaténée dans du SQL.
//
// Règle appliquée ici : mot_de_passe_hache ne remonte jamais vers les couches
// supérieures, à deux exceptions près, trouverParEmail et trouverAvecHachageParId
// (voir leurs commentaires). Toutes deux servent une comparaison bcrypt, jamais un
// affichage, et leur résultat ne quitte pas le service qui les appelle.

const { query } = require('../db');

const CHAMPS_PUBLICS = 'id, email, pseudo, role, actif, jetons_invalides_avant, date_inscription';

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

// Le changement de mot de passe pose la borne de révocation dans la même requête.
//
// Les deux vont ensemble et ne doivent pas pouvoir se dissocier : changer son mot de
// passe parce qu'on le croit compromis n'aurait aucun effet si les jetons déjà émis
// continuaient de fonctionner jusqu'à deux heures. Deux requêtes distinctes auraient
// laissé une fenêtre où la première a réussi et la seconde non.
//
// La borne est prise sur l'horloge de la base et non sur celle du serveur applicatif :
// c'est la même horloge que celle qui datera les comparaisons.
async function mettreAJourMotDePasse(id, motDePasseHache) {
  const { rowCount } = await query(
    `UPDATE utilisateur
     SET mot_de_passe_hache = $2, jetons_invalides_avant = now()
     WHERE id = $1`,
    [id, motDePasseHache]
  );
  return rowCount > 0;
}

// État d'autorisation d'un porteur de jeton, relu à chaque requête authentifiée.
//
// Une seule lecture par clé primaire, sans le hachage du mot de passe : c'est le prix de
// la révocation immédiate. Un cache de trente secondes l'éviterait, au prix d'une
// révocation différée d'autant — un compte désactivé resterait joignable une demi-minute.
// Sur une application personnelle, la lecture est négligeable devant les requêtes que
// sert la même route, et la garantie est plus simple à défendre qu'un délai.
async function trouverPourAutorisation(id) {
  const { rows } = await query(
    `SELECT id, role, actif, jetons_invalides_avant
     FROM utilisateur
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
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
  trouverPourAutorisation,
  mettreAJourMotDePasse,
  supprimer,
};
