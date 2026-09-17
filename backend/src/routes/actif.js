const express = require('express');
const controleur = require('../controllers/actif');
const valider = require('../middlewares/valider');
const validerParamId = require('../middlewares/validerParamId');
const authentifier = require('../middlewares/authentifier');
const { creationActif, modificationActif } = require('../validation/actif');
const { creationTransaction } = require('../validation/transaction');

const routeur = express.Router();

// Aucune route du portefeuille n'est publique : le middleware s'applique à toutes.
routeur.use(authentifier);

routeur.get('/', controleur.lister);
routeur.post('/', valider(creationActif), controleur.creer);

routeur.get('/:id', validerParamId('id'), controleur.detail);
routeur.patch('/:id', validerParamId('id'), valider(modificationActif), controleur.modifier);
routeur.delete('/:id', validerParamId('id'), controleur.supprimer);

routeur.post(
  '/:id/transactions',
  validerParamId('id'),
  valider(creationTransaction),
  controleur.ajouterTransaction
);
// Simulation : mêmes contrôles que la création, sans écriture. Déclarée avant la route
// paramétrée par identifiant de transaction.
routeur.post(
  '/:id/transactions/simulation',
  validerParamId('id'),
  valider(creationTransaction),
  controleur.simulerTransaction
);
// Correction d'un mouvement et sa simulation, déclarée en premier pour que `simulation`
// ne soit pas lu comme un identifiant de transaction.
routeur.post(
  '/:id/transactions/:idTransaction/simulation',
  validerParamId('id'),
  validerParamId('idTransaction'),
  valider(creationTransaction),
  controleur.simulerTransaction
);
routeur.patch(
  '/:id/transactions/:idTransaction',
  validerParamId('id'),
  validerParamId('idTransaction'),
  valider(creationTransaction),
  controleur.modifierTransaction
);
routeur.delete(
  '/:id/transactions/:idTransaction',
  validerParamId('id'),
  validerParamId('idTransaction'),
  controleur.supprimerTransaction
);

module.exports = routeur;
