const express = require('express');
const controleur = require('../controllers/portefeuille');
const authentifier = require('../middlewares/authentifier');

const routeur = express.Router();

routeur.use(authentifier);

routeur.get('/', controleur.consolide);
routeur.get('/historique', controleur.historique);

module.exports = routeur;
