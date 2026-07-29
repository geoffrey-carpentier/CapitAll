const express = require('express');
const controleur = require('../controllers/authentification');
const valider = require('../middlewares/valider');
const authentifier = require('../middlewares/authentifier');
const { schemaInscription, schemaConnexion } = require('../validation/utilisateur');

const routeur = express.Router();

routeur.post('/inscription', valider(schemaInscription), controleur.inscription);
routeur.post('/connexion', valider(schemaConnexion), controleur.connexion);
routeur.get('/moi', authentifier, controleur.profil);

module.exports = routeur;
