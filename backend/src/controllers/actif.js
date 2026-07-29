// Contrôleurs du portefeuille. L'identifiant du propriétaire vient exclusivement de
// req.utilisateur, posé par le middleware d'authentification : jamais du corps de la
// requête ni de l'URL, qui sont sous le contrôle de l'appelant.
//
// Choix de statut assumé : une ressource qui existe mais appartient à quelqu'un d'autre
// renvoie 404, et non 403. Un 403 confirmerait au demandeur que l'identifiant existe,
// ce qui permettrait d'énumérer les actifs des autres comptes par simple balayage.
// Un utilisateur ne doit pas pouvoir distinguer « cet actif n'existe pas » de
// « cet actif ne vous appartient pas ».

const modeleActif = require('../models/actif');
const { ErreurIntrouvable } = require('../erreurs');

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

// Le PRU et les plus-values relèvent d'un lot dédié et ne sont volontairement pas
// calculés ici.
async function detail(req, res, next) {
  try {
    const actif = await modeleActif.trouverParIdEtUtilisateur(req.params.id, req.utilisateur.id);
    if (!actif) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }
    res.status(200).json(actif);
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

module.exports = { lister, creer, detail, modifier, supprimer };
