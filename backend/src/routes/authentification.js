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

// Le quota précède la validation, pour qu'un corps malformé soit aussi compté.
//
// L'inscription n'est pas plafonnée : un quota par adresse ne gênerait pas une création
// en série avec des adresses différentes, et aucune adresse IP fiable n'est disponible
// sur ce déploiement.
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
