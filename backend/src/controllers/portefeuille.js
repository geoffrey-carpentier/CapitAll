// Contrôleurs du portefeuille consolidé et de son historique. Le propriétaire vient
// toujours du jeton.

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

// Actualisation : écrit le point du jour et marque les seuils franchis. POST et non GET,
// puisqu'elle modifie l'état. Elle rend le portefeuille dans la même forme que la
// lecture, pour éviter un second appel.
async function actualiser(req, res, next) {
  try {
    const portefeuille = await servicePortefeuille.actualiserPortefeuille(req.utilisateur.id);
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

module.exports = { consolide, actualiser, historique };
