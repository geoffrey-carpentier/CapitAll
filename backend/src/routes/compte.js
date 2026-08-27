const express = require('express');
const controleur = require('../controllers/compte');
const valider = require('../middlewares/valider');
const authentifier = require('../middlewares/authentifier');
const { schemaChangementMotDePasse } = require('../validation/compte');

const routeur = express.Router();

// Aucune de ces routes n'est publique : l'authentification est posée pour le routeur
// entier plutôt que répétée à chaque ligne.
routeur.use(authentifier);

routeur.patch('/mot-de-passe', valider(schemaChangementMotDePasse), controleur.changerMotDePasse);
routeur.delete('/', controleur.supprimer);
routeur.get('/export-mouvements', controleur.exporterMouvements);

module.exports = routeur;
