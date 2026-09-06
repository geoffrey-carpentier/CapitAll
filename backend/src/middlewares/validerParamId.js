// Contrôle des identifiants passés dans l'URL avant toute requête en base : un
// paramètre non entier partirait sinon jusqu'à PostgreSQL, qui répondrait par une
// erreur de conversion de type traduite en 500 alors qu'il s'agit d'une requête
// malformée, donc d'un 400.

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
