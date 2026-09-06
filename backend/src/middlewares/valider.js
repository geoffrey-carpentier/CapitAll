// Middleware de validation générique. Il s'intercale avant le contrôleur et garantit
// que celui-ci ne reçoit jamais qu'un corps de requête déjà contrôlé et normalisé.

function valider(schema) {
  return (req, res, next) => {
    const resultat = schema.safeParse(req.body);

    if (!resultat.success) {
      const champs = resultat.error.issues.map((probleme) => ({
        champ: probleme.path.join('.') || '(racine)',
        message: probleme.message,
      }));
      return res.status(400).json({ erreur: 'Données invalides.', champs });
    }

    // Le corps est remplacé par la valeur validée : le contrôleur travaille sur des
    // données normalisées (email en minuscules, espaces retirés) et sur elles seules.
    req.body = resultat.data;
    return next();
  };
}

module.exports = valider;
