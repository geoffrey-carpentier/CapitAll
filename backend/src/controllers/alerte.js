// Contrôleurs des alertes. Le propriétaire vient toujours du jeton : aucune de ces
// routes n'accepte d'identifiant d'utilisateur en entrée.

const { creerServiceAlerte } = require('../services/alerte');

const serviceAlerte = creerServiceAlerte();

async function lister(req, res, next) {
  try {
    const alertes = await serviceAlerte.lister(req.utilisateur.id);
    res.status(200).json(alertes);
  } catch (erreur) {
    next(erreur);
  }
}

async function creer(req, res, next) {
  try {
    const alerte = await serviceAlerte.creer({
      utilisateurId: req.utilisateur.id,
      donnees: req.body,
    });
    res.status(201).json(alerte);
  } catch (erreur) {
    next(erreur);
  }
}

async function desactiver(req, res, next) {
  try {
    const alerte = await serviceAlerte.desactiver({
      id: req.params.id,
      utilisateurId: req.utilisateur.id,
    });
    res.status(200).json(alerte);
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = { lister, creer, desactiver };
