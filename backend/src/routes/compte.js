const express = require('express');
const controleur = require('../controllers/compte');
const valider = require('../middlewares/valider');
const authentifier = require('../middlewares/authentifier');
const { schemaChangementMotDePasse, schemaSuppressionCompte } = require('../validation/compte');

const routeur = express.Router();

routeur.use(authentifier);

routeur.patch('/mot-de-passe', valider(schemaChangementMotDePasse), controleur.changerMotDePasse);
routeur.delete('/', valider(schemaSuppressionCompte), controleur.supprimer);
routeur.get('/export-mouvements', controleur.exporterMouvements);

module.exports = routeur;
