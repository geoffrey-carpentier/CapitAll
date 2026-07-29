const express = require('express');
const controleur = require('../controllers/authentification');
const valider = require('../middlewares/valider');
const { schemaInscription } = require('../validation/utilisateur');

const routeur = express.Router();

routeur.post('/inscription', valider(schemaInscription), controleur.inscription);

module.exports = routeur;
