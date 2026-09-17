// Contrôleurs du portefeuille. Le propriétaire vient toujours de req.utilisateur (posé
// par le middleware d'authentification), jamais du corps ni de l'URL.
//
// Une ressource d'un autre compte renvoie 404 et non 403 : un 403 confirmerait que
// l'identifiant existe et permettrait d'énumérer les actifs des autres comptes.

const modeleActif = require('../models/actif');
const { creerServiceTransaction } = require('../services/transaction');
const { creerServicePortefeuille } = require('../services/portefeuilleConsolide');
const { ErreurIntrouvable } = require('../erreurs');

const servicePortefeuille = creerServicePortefeuille();
const serviceTransaction = creerServiceTransaction();

async function lister(req, res, next) {
  try {
    const actifs = await modeleActif.listerParUtilisateur(req.utilisateur.id);
    res.status(200).json(actifs);
  } catch (erreur) {
    next(erreur);
  }
}

async function creer(req, res, next) {
  try {
    const actif = await modeleActif.creer({
      utilisateurId: req.utilisateur.id,
      type: req.body.type,
      symbole: req.body.symbole,
      nom: req.body.nom,
    });
    res.status(201).json(actif);
  } catch (erreur) {
    next(erreur);
  }
}

// Détail d'un actif : position calculée (quantité détenue, PRU, plus-values), cours
// courant avec sa source, et historique des transactions.
async function detail(req, res, next) {
  try {
    const detailActif = await servicePortefeuille.obtenirDetailActif(
      req.params.id,
      req.utilisateur.id
    );
    res.status(200).json(detailActif);
  } catch (erreur) {
    next(erreur);
  }
}

async function modifier(req, res, next) {
  try {
    const actif = await modeleActif.mettreAJourNom(
      req.params.id,
      req.utilisateur.id,
      req.body.nom
    );
    if (!actif) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }
    res.status(200).json(actif);
  } catch (erreur) {
    next(erreur);
  }
}

async function supprimer(req, res, next) {
  try {
    const supprime = await modeleActif.supprimer(req.params.id, req.utilisateur.id);
    if (!supprime) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

async function ajouterTransaction(req, res, next) {
  try {
    const transaction = await serviceTransaction.enregistrer({
      actifId: req.params.id,
      utilisateurId: req.utilisateur.id,
      donnees: req.body,
    });
    res.status(201).json(transaction);
  } catch (erreur) {
    next(erreur);
  }
}

// Effet d'un mouvement sans l'enregistrer : 200 et non 201, rien n'est créé.
async function simulerTransaction(req, res, next) {
  try {
    const effet = await serviceTransaction.simuler({
      actifId: req.params.id,
      // Sur la route de correction, la simulation remplace ce mouvement.
      idTransaction: req.params.idTransaction ?? null,
      utilisateurId: req.utilisateur.id,
      donnees: req.body,
    });
    res.status(200).json(effet);
  } catch (erreur) {
    next(erreur);
  }
}

// Correction d'un mouvement : 200, la ressource existante est modifiée. PATCH et non PUT,
// car le corps ne porte que les champs modifiables, pas la ressource complète.
async function modifierTransaction(req, res, next) {
  try {
    const transaction = await serviceTransaction.modifier({
      actifId: req.params.id,
      idTransaction: req.params.idTransaction,
      utilisateurId: req.utilisateur.id,
      donnees: req.body,
    });
    res.status(200).json(transaction);
  } catch (erreur) {
    next(erreur);
  }
}

async function supprimerTransaction(req, res, next) {
  try {
    await serviceTransaction.supprimer({
      actifId: req.params.id,
      idTransaction: req.params.idTransaction,
      utilisateurId: req.utilisateur.id,
    });
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = {
  lister,
  creer,
  detail,
  modifier,
  supprimer,
  ajouterTransaction,
  simulerTransaction,
  modifierTransaction,
  supprimerTransaction,
};
