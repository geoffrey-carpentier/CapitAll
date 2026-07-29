// Premier des trois niveaux de contrôle d'accès : le jeton est-il valide ?
// Viennent ensuite la propriété de la ressource, puis le rôle (exigerRole).

const jwt = require('jsonwebtoken');
const config = require('../config');

const PREFIXE_BEARER = 'Bearer ';

function authentifier(req, res, next) {
  const entete = req.headers.authorization;

  // Distinguer l'absence de jeton du jeton refusé aide le client à savoir s'il doit
  // se connecter ou se reconnecter. Aucun des deux messages n'expose la cause technique.
  if (!entete || !entete.startsWith(PREFIXE_BEARER)) {
    return res.status(401).json({ erreur: "Jeton d'authentification absent." });
  }

  const token = entete.slice(PREFIXE_BEARER.length).trim();

  try {
    const charge = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.utilisateur = { id: charge.sub, role: charge.role };
    return next();
  } catch (erreur) {
    // Expiration et signature invalide sont volontairement traitées de la même façon.
    return res.status(401).json({ erreur: "Jeton d'authentification invalide ou expiré." });
  }
}

module.exports = authentifier;
