const express = require('express');
const authentifier = require('../middlewares/authentifier');
const { obtenirCatalogue } = require('../services/catalogueSymboles');

const routeur = express.Router();

// Sans donnée d'utilisateur, le catalogue reste derrière l'authentification comme le
// reste de l'API.
routeur.use(authentifier);

// Lecture pure, sans appel fournisseur.
routeur.get('/', (req, res) => {
  res.status(200).json(obtenirCatalogue());
});

module.exports = routeur;
