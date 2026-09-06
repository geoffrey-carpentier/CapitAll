const express = require('express');
const authentifier = require('../middlewares/authentifier');
const { obtenirCatalogue } = require('../services/catalogueSymboles');

const routeur = express.Router();

// Le catalogue ne porte aucune donnée d'utilisateur, mais il décrit le périmètre du
// service : il reste derrière l'authentification, comme le reste de l'API, plutôt que
// d'ouvrir une route publique pour une information qui n'a d'usage qu'une fois connecté.
routeur.use(authentifier);

// Lecture pure, sans effet de bord et sans appel fournisseur : le catalogue décrit ce
// que l'application accepte, il n'interroge pas les cotations.
routeur.get('/', (req, res) => {
  res.status(200).json(obtenirCatalogue());
});

module.exports = routeur;
