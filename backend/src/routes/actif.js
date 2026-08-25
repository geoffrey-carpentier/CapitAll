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
// Même corps et mêmes contrôles que la création, mais sans écriture : la route rend
// l'effet qu'aurait le mouvement sur la position. Elle est déclarée avant la route
// paramétrée par identifiant de transaction, qui ne répond qu'en DELETE.
routeur.post(
  '/:id/transactions/simulation',
  validerParamId('id'),
  valider(creationTransaction),
  controleur.simulerTransaction
);
routeur.delete(
  '/:id/transactions/:idTransaction',
  validerParamId('id'),
  validerParamId('idTransaction'),
  controleur.supprimerTransaction
);

module.exports = routeur;
