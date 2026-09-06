// Contrôleurs d'authentification : lecture de la requête, code de statut, format de
// réponse. Aucune règle métier ici, et aucune erreur traitée sur place : elles sont
// transmises au gestionnaire centralisé par next().

const serviceAuthentification = require('../services/authentification');
const modeleUtilisateur = require('../models/utilisateur');
const serviceRecuperation = require('../services/recuperation');
const { reinitialiserQuotaConnexion } = require('../middlewares/quota');

async function inscription(req, res, next) {
  try {
    const utilisateur = await serviceAuthentification.inscrire(req.body);
    res.status(201).json({
      id: utilisateur.id,
      email: utilisateur.email,
      pseudo: utilisateur.pseudo,
      role: utilisateur.role,
    });
  } catch (erreur) {
    next(erreur);
  }
}

async function connexion(req, res, next) {
  try {
    const resultat = await serviceAuthentification.connecter(req.body);
    // Une connexion réussie efface les échecs comptés pour cette adresse. Sans cela, un
    // tiers qui aurait épuisé neuf tentatives laisserait le titulaire du compte avec une
    // seule, alors qu'il vient précisément de prouver qu'il est le titulaire.
    reinitialiserQuotaConnexion(req.body?.email);
    res.status(200).json(resultat);
  } catch (erreur) {
    next(erreur);
  }
}

// Demande de récupération d'un mot de passe oublié.
//
// 202 et non 201 : la demande est prise en compte, et la réponse ne dit pas si elle a
// produit quelque chose. C'est exactement ce que le statut signifie, et c'est ce qui
// interdit d'utiliser ce formulaire pour découvrir quelles adresses ont un compte.
async function demanderRecuperation(req, res, next) {
  try {
    const resultat = await serviceRecuperation.demander(req.body);
    res.status(202).json(resultat);
  } catch (erreur) {
    next(erreur);
  }
}

async function reinitialiser(req, res, next) {
  try {
    await serviceRecuperation.reinitialiser(req.body);
    // Aucun jeton n'est remis : la réinitialisation ne connecte pas. Celui qui vient de
    // poser un mot de passe doit s'en servir, ce qui prouve qu'il l'a bien enregistré.
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

// Profil du porteur du jeton. Sert aussi de route protégée de référence pour vérifier
// le middleware d'authentification.
async function profil(req, res, next) {
  try {
    const utilisateur = await modeleUtilisateur.trouverParId(req.utilisateur.id);
    if (!utilisateur) {
      return res.status(404).json({ erreur: 'Utilisateur introuvable.' });
    }
    return res.status(200).json(utilisateur);
  } catch (erreur) {
    return next(erreur);
  }
}

module.exports = { inscription, connexion, demanderRecuperation, reinitialiser, profil };
