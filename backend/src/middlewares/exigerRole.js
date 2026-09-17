// Contrôle du rôle, toujours après authentifier. Le rôle admin n'ouvre jamais l'accès
// aux données patrimoniales d'autrui.

function exigerRole(roleAttendu) {
  return (req, res, next) => {
    if (!req.utilisateur) {
      return res.status(401).json({ erreur: "Jeton d'authentification absent." });
    }

    if (req.utilisateur.role !== roleAttendu) {
      return res.status(403).json({ erreur: 'Action réservée à un autre rôle.' });
    }

    return next();
  };
}

module.exports = exigerRole;
