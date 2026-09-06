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

// Actualisation demandée : relève les cours du jour et évalue les seuils.
//
// Une commande, donc un POST, et non un GET paramétré. Elle change l'état — le point du
// jour est écrit, les seuils franchis sont marqués — et c'est justement ce qu'un GET ne
// doit pas faire. Le verbe suffit à empêcher qu'un préchargeur ou un rechargement la
// rejoue.
//
// Elle rend le portefeuille dans la même forme que la lecture : l'appelant qui vient
// d'actualiser n'a pas à enchaîner un second appel pour afficher le résultat.
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
