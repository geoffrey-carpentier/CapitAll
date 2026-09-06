const express = require('express');
const controleur = require('../controllers/alerte');
const valider = require('../middlewares/valider');
const validerParamId = require('../middlewares/validerParamId');
const authentifier = require('../middlewares/authentifier');
const { creationAlerte, modificationAlerte } = require('../validation/alerte');

const routeur = express.Router();

routeur.use(authentifier);

routeur.get('/', controleur.lister);
routeur.post('/', valider(creationAlerte), controleur.creer);
routeur.patch('/:id', validerParamId('id'), valider(modificationAlerte), controleur.desactiver);

module.exports = routeur;
