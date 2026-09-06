// Premier des trois niveaux de contrôle d'accès : le porteur est-il autorisé ?
// Viennent ensuite la propriété de la ressource, puis le rôle (exigerRole).
//
// Le contrôle ne s'arrête pas à la signature du jeton. Un jeton valide reste valide
// jusqu'à son expiration, quoi qu'il arrive au compte entre-temps : D60 a créé la
// désactivation d'un compte, la connexion la respectait, et un jeton déjà émis
// continuait pourtant de servir pendant deux heures. La désactivation était annoncée
// sans être appliquée.
//
// Deux vérifications s'ajoutent donc à la signature, sur une lecture par clé primaire :
//
//   1. le compte est-il encore actif ;
//   2. le jeton a-t-il été émis après la borne de révocation du compte.
//
// La borne est posée au changement de mot de passe, et peut l'être à la main pour
// couper l'accès d'un compte compromis. Une borne plutôt qu'une liste de jetons
// révoqués : un jeton porte sa date d'émission, il suffit de la comparer.

const jwt = require('jsonwebtoken');
const config = require('../config');
const modeleUtilisateur = require('../models/utilisateur');

const PREFIXE_BEARER = 'Bearer ';

// Un jeton révoqué ou un compte désactivé rendent 401 et non 403, à la différence de la
// connexion qui refuse un compte désactivé en 403. La nuance n'est pas cosmétique :
// 401 signifie « cette session ne vaut plus », et c'est le signal auquel l'interface
// réagit en vidant son état et en ramenant vers la connexion. Un 403 laisserait
// l'utilisateur devant un écran mort, avec un jeton qu'il ne peut plus utiliser. La
// raison du refus lui est alors donnée à la reconnexion, où elle a un sens.
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

// `iat` est en secondes, la borne au millième. La comparaison se fait donc à la seconde,
// et le sens de l'arrondi est un choix, pas un détail.
//
// Un jeton émis dans la même seconde que la borne est **accepté**. Arrondir dans l'autre
// sens refuserait le jeton émis juste après un changement de mot de passe — celui qui
// vient d'être remis à l'utilisateur — et le déconnecterait de l'opération qu'il vient
// de réussir. Le prix est une fenêtre d'une seconde pendant laquelle un jeton antérieur
// survit. Entre une seconde de sursis et une session neuve invalidée d'office, le choix
// n'est pas disputable.
function estRevoque(charge, borne) {
  if (!borne || !charge.iat) {
    return false;
  }

  return charge.iat < Math.floor(new Date(borne).getTime() / 1000);
}

// Instance par défaut, utilisée par les routes : leur code reste inchangé.
const authentifier = creerAuthentifier();

module.exports = authentifier;
module.exports.creerAuthentifier = creerAuthentifier;
module.exports.MESSAGE_SESSION_CLOSE = MESSAGE_SESSION_CLOSE;
