// Contrôleurs du portefeuille consolidé et de son historique. Le propriétaire vient
// toujours du jeton : aucune de ces routes n'accepte d'identifiant d'utilisateur.

const { creerServicePortefeuille } = require('../services/portefeuilleConsolide');

const servicePortefeuille = creerServicePortefeuille();

// Nombre de jours d'historique demandé, borné pour éviter une requête déraisonnable.
const JOURS_MAXIMUM = 3650;

async function consolide(req, res, next) {
  try {
    const portefeuille = await servicePortefeuille.obtenirPortefeuille(req.utilisateur.id);
    res.status(200).json(portefeuille);
  } catch (erreur) {
    next(erreur);
  }
}

async function historique(req, res, next) {
  try {
    const parametre = req.query.jours;
    let jours;

    if (parametre !== undefined) {
      if (!/^\d+$/.test(parametre) || Number(parametre) < 1 || Number(parametre) > JOURS_MAXIMUM) {
        return res.status(400).json({ erreur: 'Le paramètre jours est invalide.' });
      }
      jours = Number(parametre);
    }

    const snapshots = await servicePortefeuille.obtenirHistorique(req.utilisateur.id, jours);
    return res.status(200).json(snapshots);
  } catch (erreur) {
    return next(erreur);
  }
}

module.exports = { consolide, historique };
