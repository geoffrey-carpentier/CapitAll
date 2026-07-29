const express = require('express');
const controleur = require('../controllers/actif');
const valider = require('../middlewares/valider');
const validerParamId = require('../middlewares/validerParamId');
const authentifier = require('../middlewares/authentifier');
const { creationActif, modificationActif } = require('../validation/actif');

const routeur = express.Router();

// Aucune route du portefeuille n'est publique : le middleware s'applique à toutes.
routeur.use(authentifier);

routeur.get('/', controleur.lister);
routeur.post('/', valider(creationActif), controleur.creer);

routeur.get('/:id', validerParamId('id'), controleur.detail);
routeur.patch('/:id', validerParamId('id'), valider(modificationActif), controleur.modifier);
routeur.delete('/:id', validerParamId('id'), controleur.supprimer);

module.exports = routeur;
