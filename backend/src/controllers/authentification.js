// Contrôleurs d'authentification : requête, statut et réponse. Les erreurs sont
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
    // Une connexion réussie efface les échecs comptés pour cette adresse.
    reinitialiserQuotaConnexion(req.body?.email);
    res.status(200).json(resultat);
  } catch (erreur) {
    next(erreur);
  }
}

// Demande de récupération : 202, la demande est acceptée sans dire si un compte existe.
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
    // Aucun jeton remis : la réinitialisation ne connecte pas.
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

// Profil du porteur du jeton.
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
