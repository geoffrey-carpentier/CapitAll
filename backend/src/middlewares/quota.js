// Limitation de débit sur les chemins d'authentification.
//
// Le quota est compté par adresse électronique et non par IP : derrière Nginx, req.ip
// vaut la même valeur pour tous les clients, et un quota par IP les bloquerait tous à la
// fois. `trust proxy` n'est pas posé : les réglages usuels couvrent la passerelle Docker
// et laisseraient un X-Forwarded-For forgé choisir son compteur. À réexaminer, avec une
// valeur bornée au proxy réellement maîtrisé, si le relais transmet un jour l'adresse
// cliente. Limite assumée en attendant : un tiers peut épuiser les tentatives d'un
// compte jusqu'à la fin de la fenêtre.

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
