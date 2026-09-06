// Limitation de débit sur les chemins d'authentification.
//
// ---------------------------------------------------------------------------
// POURQUOI LE QUOTA N'EST PAS PORTÉ PAR L'ADRESSE IP
// ---------------------------------------------------------------------------
//
// La question a été tranchée par la mesure, pas par l'usage. Relevé du 05/09/2026
// derrière le Nginx du projet, détail dans la revue d'exécution :
//
//   sans `trust proxy`   req.ip vaut l'adresse du conteneur Nginx, identique pour tous
//                        les clients et à chaque requête ;
//   avec `trust proxy`   req.ip vaut la passerelle Docker, la publication de port
//                        traduisant l'adresse : toutes les machines qui atteignent le
//                        port publié se réduisent à cette seule valeur.
//
// Autrement dit, aucun réglage ne restitue l'adresse du client sur ce déploiement. Un
// quota par IP y compterait le monde entier sur un compteur unique : le premier
// utilisateur à l'épuiser verrouillerait tous les autres. C'est l'inverse de ce qu'on
// attend d'une protection.
//
// Pire, le réglage nommé souvent recommandé — 'loopback, linklocal, uniquelocal' —
// couvre la plage de la passerelle : la chaîne continue d'être remontée et un
// X-Forwarded-For forgé l'emporte. N'importe qui choisirait alors son compartiment de
// quota, ou celui d'un autre. `trust proxy` reste donc non posé.
//
// Le quota est porté par ce que l'application connaît réellement : l'adresse
// électronique soumise. C'est un identifiant qui distingue les clients, là où l'adresse
// réseau n'en distingue aucun.
//
// ---------------------------------------------------------------------------
// LA LIMITE QUI SUBSISTE, ET QU'IL FAUT DIRE
// ---------------------------------------------------------------------------
//
// Un quota par compte permet, à lui seul, de gêner l'accès d'un tiers en épuisant ses
// tentatives à sa place. Deux choix atténuent cela sans le supprimer :
//
//   1. seuls les échecs comptent, et une connexion réussie **remet le compteur à zéro**
//      pour cette adresse. Un tiers qui échoue neuf fois ne gêne donc personne : la
//      connexion légitime qui suit passe et efface ce qu'il a consommé. Le refus
//      automatique de la bibliothèque ne fait que rembourser la requête réussie, ce qui
//      ne suffisait pas — d'où la remise à zéro explicite ci-dessous ;
//   2. le seuil est haut et la fenêtre courte, de sorte que la gêne reste une gêne.
//
// Ce qui reste possible, et qu'il faut assumer : un tiers qui épuise les dix tentatives
// d'affilée, avant que le titulaire n'essaie, lui ferme l'accès pour le reste de la
// fenêtre. Aucun quota par compte ne peut l'éviter.
//
// La suppression complète du risque demanderait une adresse cliente véritable, donc un
// relais qui en transmette une. Le jour où ce sera le cas, la mesure sera à refaire :
// elle dépend de la topologie du déploiement, jamais du code.

const rateLimit = require('express-rate-limit');

const FENETRE_MINUTES = 15;

// Dix échecs consécutifs sur une même adresse. Un utilisateur qui hésite entre deux de
// ses mots de passe n'y arrive pas ; une tentative méthodique, si.
const ECHECS_AVANT_BLOCAGE = 10;

// La demande de réinitialisation ne se compte pas de la même façon : elle réussit
// toujours, du point de vue HTTP, puisqu'elle rend la même réponse que l'adresse existe
// ou non. Ce sont donc les demandes elles-mêmes qui sont plafonnées, et plus bas : cinq
// demandes par quart d'heure suffisent largement à un usage légitime.
const DEMANDES_AVANT_BLOCAGE = 5;

const MESSAGE_TROP_DE_TENTATIVES =
  'Trop de tentatives pour cette adresse. Réessayez dans quelques minutes.';

// Clé du compteur : l'adresse soumise, normalisée comme le fait la validation, de sorte
// que « Camille@Exemple.fr » et « camille@exemple.fr » partagent bien le même compteur.
//
// Une requête sans adresse exploitable — corps absent, malformé — retombe sur une clé
// commune. Elle sera de toute façon refusée par la validation, et lui donner une clé
// propre offrirait un contournement gratuit du quota.
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
  // La bibliothèque avertit lorsqu'une clé personnalisée ne dérive pas de l'adresse IP,
  // et lorsque `trust proxy` n'est pas posé. Les deux sont ici des choix mesurés et
  // documentés plus haut, pas des oublis : l'avertissement est donc levé, pour lui et
  // pour rien d'autre.
  validate: { keyGeneratorIpFallback: false, trustProxy: false, xForwardedForHeader: false },
};

// Connexion : seuls les échecs consomment le quota.
const quotaConnexion = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: ECHECS_AVANT_BLOCAGE,
  skipSuccessfulRequests: true,
});

// Réinitialisation : ce sont les demandes qui sont comptées, la réponse étant toujours
// la même. Le second plafond porte sur l'usage d'un jeton, où l'adresse n'est pas
// soumise : la clé y retombe sur la valeur commune, ce qui est le comportement voulu —
// un jeton se devine par force brute globale, pas compte par compte.
const quotaDemandeRecuperation = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: DEMANDES_AVANT_BLOCAGE,
});

const quotaReinitialisation = rateLimit({
  ...OPTIONS_COMMUNES,
  limit: ECHECS_AVANT_BLOCAGE,
  skipSuccessfulRequests: true,
});

// Remise à zéro du compteur d'une adresse, appelée après une connexion réussie.
//
// La bibliothèque sait rembourser la requête réussie ; elle ne sait pas effacer les
// échecs qui la précèdent. C'est pourtant ce qui compte : sans cette remise à zéro, un
// tiers qui a épuisé neuf tentatives laisserait le titulaire du compte avec une seule.
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
