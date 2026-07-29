// Troisième niveau de contrôle d'accès (D23), à placer systématiquement après
// authentifier : sans req.utilisateur, il n'y a pas de rôle à contrôler.
// Le rôle admin reste à moindre privilège, il n'ouvre jamais l'accès aux données
// patrimoniales d'autrui, qui relèvent de la vérification de propriété.

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
