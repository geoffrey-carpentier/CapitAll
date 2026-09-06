const express = require('express');
const controleur = require('../controllers/portefeuille');
const authentifier = require('../middlewares/authentifier');

const routeur = express.Router();

routeur.use(authentifier);

// La lecture ne change rien : elle peut être rejouée, préchargée ou mise en cache sans
// conséquence. L'actualisation, elle, relève le point du jour et marque les seuils
// franchis : c'est une commande, elle porte un verbe qui le dit.
routeur.get('/', controleur.consolide);
routeur.post('/actualisation', controleur.actualiser);
routeur.get('/historique', controleur.historique);

module.exports = routeur;
