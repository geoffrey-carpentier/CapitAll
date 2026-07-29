const express = require('express');
const controleur = require('../controllers/authentification');
const valider = require('../middlewares/valider');
const { schemaInscription, schemaConnexion } = require('../validation/utilisateur');

const routeur = express.Router();

routeur.post('/inscription', valider(schemaInscription), controleur.inscription);
routeur.post('/connexion', valider(schemaConnexion), controleur.connexion);

module.exports = routeur;
