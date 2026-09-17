// Contrôle des identifiants d'URL avant la base : un paramètre non entier doit donner
// un 400, pas une erreur de conversion PostgreSQL traduite en 500.

function validerParamId(nomParametre) {
  return (req, res, next) => {
    const valeur = req.params[nomParametre];

    if (!/^\d+$/.test(valeur) || Number(valeur) < 1) {
      return res.status(400).json({ erreur: `L'identifiant ${nomParametre} est invalide.` });
    }

    req.params[nomParametre] = Number(valeur);
    return next();
  };
}

module.exports = validerParamId;
