// Premier des trois niveaux de contrôle d'accès : le porteur est-il autorisé ?
// Viennent ensuite la propriété de la ressource, puis le rôle (exigerRole).
//
// Au-delà de la signature, le compte est relu par clé primaire : il doit être actif, et
// le jeton émis après sa borne de révocation. La borne est posée au changement de mot
// de passe ; une borne plutôt qu'une liste de jetons, car un jeton porte sa date.

const jwt = require('jsonwebtoken');
const config = require('../config');
const modeleUtilisateur = require('../models/utilisateur');

const PREFIXE_BEARER = 'Bearer ';

// Jeton révoqué ou compte désactivé : 401 et non 403. C'est le signal sur lequel
// l'interface vide la session et ramène à la connexion, où la raison du refus est donnée.
const MESSAGE_SESSION_CLOSE = "Votre session a été close. Reconnectez-vous.";

function creerAuthentifier({ utilisateurs = modeleUtilisateur } = {}) {
  return async function authentifier(req, res, next) {
    const entete = req.headers.authorization;

    // Distinguer l'absence de jeton du jeton refusé aide le client à savoir s'il doit
    // se connecter ou se reconnecter. Aucun des deux messages n'expose la cause technique.
    if (!entete || !entete.startsWith(PREFIXE_BEARER)) {
      return res.status(401).json({ erreur: "Jeton d'authentification absent." });
    }

    const token = entete.slice(PREFIXE_BEARER.length).trim();

    let charge;
    try {
      charge = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      // Expiration et signature invalide sont volontairement traitées de la même façon.
      return res.status(401).json({ erreur: "Jeton d'authentification invalide ou expiré." });
    }

    try {
      const utilisateur = await utilisateurs.trouverPourAutorisation(charge.sub);

      // Compte supprimé depuis l'émission du jeton : le porteur n'existe plus.
      if (!utilisateur || !utilisateur.actif) {
        return res.status(401).json({ erreur: MESSAGE_SESSION_CLOSE });
      }

      if (estRevoque(charge, utilisateur.jetons_invalides_avant)) {
        return res.status(401).json({ erreur: MESSAGE_SESSION_CLOSE });
      }

      // Le rôle est relu en base et non repris du jeton : un rôle retiré doit prendre
      // effet immédiatement, et le jeton porte celui qui valait à l'émission.
      req.utilisateur = { id: utilisateur.id, role: utilisateur.role };
      return next();
    } catch (erreur) {
      return next(erreur);
    }
  };
}

// `iat` est en secondes, la borne au millième : la comparaison se fait à la seconde, et
// un jeton émis dans la même seconde que la borne est accepté. Sinon, le jeton remis
// juste après un changement de mot de passe serait refusé ; le prix est une seconde de
// sursis pour un jeton antérieur.
function estRevoque(charge, borne) {
  if (!borne || !charge.iat) {
    return false;
  }

  return charge.iat < Math.floor(new Date(borne).getTime() / 1000);
}

const authentifier = creerAuthentifier();

module.exports = authentifier;
module.exports.creerAuthentifier = creerAuthentifier;
module.exports.MESSAGE_SESSION_CLOSE = MESSAGE_SESSION_CLOSE;
