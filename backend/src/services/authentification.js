// Logique métier de l'authentification. Ce service ne connaît ni Express ni les codes
// HTTP : il renvoie des données ou lève une erreur métier, ce qui le rend testable seul.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const modeleUtilisateur = require('../models/utilisateur');
const { ErreurConflit, ErreurAuthentification } = require('../erreurs');

const COUT_HACHAGE = 10;

// Code renvoyé par PostgreSQL sur violation d'une contrainte d'unicité.
const CODE_VIOLATION_UNICITE = '23505';

const LONGUEUR_MAXIMALE_PSEUDO = 100;

// Le pseudo est facultatif à l'inscription alors que la colonne est obligatoire :
// à défaut, on reprend la partie locale de l'email.
function pseudoParDefaut(email) {
  return email.split('@')[0].slice(0, LONGUEUR_MAXIMALE_PSEUDO);
}

async function inscrire({ email, motDePasse, pseudo }) {
  const motDePasseHache = await bcrypt.hash(motDePasse, COUT_HACHAGE);

  try {
    return await modeleUtilisateur.creerUtilisateur({
      email,
      motDePasseHache,
      pseudo: pseudo || pseudoParDefaut(email),
    });
  } catch (erreur) {
    // Deux inscriptions simultanées sur le même email passeraient toutes deux un
    // contrôle préalable en lecture : c'est la contrainte d'unicité de la base qui
    // fait foi, et sa violation est traduite ici en erreur métier.
    if (erreur.code === CODE_VIOLATION_UNICITE) {
      throw new ErreurConflit('Cet email est déjà utilisé.');
    }
    throw erreur;
  }
}

// Hachage neutre, servant de comparaison de repli quand l'email est inconnu.
// Sans lui, une réponse immédiate sur email inexistant et une réponse retardée par
// bcrypt sur email existant permettraient de déterminer quels comptes existent.
const HACHAGE_FACTICE = bcrypt.hashSync('comparaison-a-temps-constant', COUT_HACHAGE);

const MESSAGE_ECHEC = 'Email ou mot de passe incorrect.';

async function connecter({ email, motDePasse }) {
  const utilisateur = await modeleUtilisateur.trouverParEmail(email);
  const hachageAComparer = utilisateur ? utilisateur.mot_de_passe_hache : HACHAGE_FACTICE;

  const motDePasseValide = await bcrypt.compare(motDePasse, hachageAComparer);

  // Un seul message pour les deux causes d'échec : rien n'indique si c'est l'email
  // ou le mot de passe qui est en cause.
  if (!utilisateur || !motDePasseValide) {
    throw new ErreurAuthentification(MESSAGE_ECHEC);
  }

  const token = jwt.sign({ sub: utilisateur.id, role: utilisateur.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiration,
  });

  return {
    token,
    utilisateur: {
      id: utilisateur.id,
      email: utilisateur.email,
      pseudo: utilisateur.pseudo,
      role: utilisateur.role,
    },
  };
}

module.exports = { inscrire, connecter };
