// Contrôleurs d'authentification : lecture de la requête, code de statut, format de
// réponse. Aucune règle métier ici, et aucune erreur traitée sur place : elles sont
// transmises au gestionnaire centralisé par next().

const serviceAuthentification = require('../services/authentification');
const modeleUtilisateur = require('../models/utilisateur');

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
    res.status(200).json(resultat);
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

module.exports = { inscription, connexion, profil };
