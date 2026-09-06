const express = require('express');
const controleur = require('../controllers/authentification');
const valider = require('../middlewares/valider');
const authentifier = require('../middlewares/authentifier');
const {
  quotaConnexion,
  quotaDemandeRecuperation,
  quotaReinitialisation,
} = require('../middlewares/quota');
const {
  schemaInscription,
  schemaConnexion,
  schemaDemandeRecuperation,
  schemaReinitialisation,
} = require('../validation/utilisateur');

const routeur = express.Router();

// Le quota précède la validation sur les chemins protégés : sa clé est l'adresse
// soumise, qu'il lit dans le corps brut, et le faire passer après laisserait un corps
// malformé consommer le temps du serveur sans jamais être compté.
//
// L'inscription n'est pas plafonnée, et c'est un choix explicite. Un quota par adresse
// n'y protégerait de rien : créer des comptes en série se fait avec des adresses toutes
// différentes, donc des compteurs tous distincts. Seule une adresse cliente véritable
// permettrait de s'y opposer, et la mesure a établi qu'il n'y en a pas sur ce
// déploiement — la poser ici serait une protection de façade.
routeur.post('/inscription', valider(schemaInscription), controleur.inscription);
routeur.post('/connexion', quotaConnexion, valider(schemaConnexion), controleur.connexion);

routeur.post(
  '/mot-de-passe-oublie',
  quotaDemandeRecuperation,
  valider(schemaDemandeRecuperation),
  controleur.demanderRecuperation
);
routeur.post(
  '/reinitialisation',
  quotaReinitialisation,
  valider(schemaReinitialisation),
  controleur.reinitialiser
);

routeur.get('/moi', authentifier, controleur.profil);

module.exports = routeur;
