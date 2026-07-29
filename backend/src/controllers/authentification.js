// Contrôleurs d'authentification : lecture de la requête, code de statut, format de
// réponse. Aucune règle métier ici, et aucune erreur traitée sur place : elles sont
// transmises au gestionnaire centralisé par next().

const serviceAuthentification = require('../services/authentification');

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

module.exports = { inscription };
