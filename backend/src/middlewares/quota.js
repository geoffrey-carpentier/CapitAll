// Limitation de débit sur les chemins d'authentification.
//
// Le quota est compté par adresse électronique et non par adresse IP. Derrière le Nginx
// du déploiement Docker, req.ip vaut la même valeur pour tous les clients (conteneur
// Nginx sans `trust proxy`, passerelle Docker avec) : un quota par IP bloquerait tout le
// monde à la fois. `trust proxy` reste non posé, car les réglages usuels couvrent la
// passerelle et laisseraient un X-Forwarded-For forgé choisir son compteur.
//
// Limite assumée : un tiers peut épuiser les tentatives d'un compte. Seuls les échecs
// comptent, une connexion réussie remet le compteur à zéro, et la fenêtre est courte,
// mais dix échecs d'affilée bloquent le titulaire jusqu'à la fin de la fenêtre. À
// réexaminer si le relais transmet un jour l'adresse cliente réelle.

const rateLimit = require('express-rate-limit');

const FENETRE_MINUTES = 15;

const ECHECS_AVANT_BLOCAGE = 10;

// Une demande de réinitialisation réussit toujours (réponse identique que l'adresse
// existe ou non) : ce sont les demandes elles-mêmes qui sont plafonnées.
const DEMANDES_AVANT_BLOCAGE = 5;

const MESSAGE_TROP_DE_TENTATIVES =
  'Trop de tentatives pour cette adresse. Réessayez dans quelques minutes.';

// Clé du compteur : l'adresse normalisée comme dans la validation. Sans adresse
// exploitable, une clé commune est utilisée, pour ne pas offrir de contournement.
function cleParEmail(req) {
  const email = req.body?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : 'sans-adresse';
}

function refuser(req, res) {
  res.status(429).json({ erreur: MESSAGE_TROP_DE_TENTATIVES });
}

const OPTIONS_COMMUNES = {
  windowMs: FENETRE_MINUTES * 60 * 1000,
  keyGenerator: cleParEmail,
  handler: refuser,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Avertissements de la bibliothèque désactivés : clé hors IP et `trust proxy` absent
  // sont des choix expliqués en tête de fichier.
  validate: { keyGeneratorIpFallback: false, trustProxy: false, xForwardedForHeader: false },
};

// Connexion : seuls les échecs consomment le quota.
const quotaConnexion = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: ECHECS_AVANT_BLOCAGE,
  skipSuccessfulRequests: true,
});

// Réinitialisation : les demandes sont comptées. Le second plafond porte sur l'usage
// d'un jeton, sans adresse soumise : la clé commune limite une force brute globale.
const quotaDemandeRecuperation = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: DEMANDES_AVANT_BLOCAGE,
});

const quotaReinitialisation = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: ECHECS_AVANT_BLOCAGE,
  skipSuccessfulRequests: true,
});

// Appelée après une connexion réussie : la bibliothèque ne rembourse que la requête
// réussie, pas les échecs qui la précèdent.
function reinitialiserQuotaConnexion(email) {
  if (typeof email !== 'string' || !email.trim()) {
    return;
  }
  quotaConnexion.resetKey(email.trim().toLowerCase());
}

module.exports = {
  quotaConnexion,
  reinitialiserQuotaConnexion,
  quotaDemandeRecuperation,
  quotaReinitialisation,
  MESSAGE_TROP_DE_TENTATIVES,
  ECHECS_AVANT_BLOCAGE,
  DEMANDES_AVANT_BLOCAGE,
  FENETRE_MINUTES,
};
