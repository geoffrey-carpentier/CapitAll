const express = require('express');
const cors = require('cors');
const config = require('./config');

const routeurAuthentification = require('./routes/authentification');
const routeurActif = require('./routes/actif');
const routeurPortefeuille = require('./routes/portefeuille');
const routeurAlerte = require('./routes/alerte');
const routeurCompte = require('./routes/compte');
const routeurSymbole = require('./routes/symbole');
const gestionErreurs = require('./middlewares/gestionErreurs');

const app = express();

// CORS limité à l'origine de l'interface ; l'en-tête Authorization est admis pour
// transmettre le jeton.
app.use(
  cors({
    origin: config.origineAutorisee,
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Nom du fichier d'export, lisible par l'interface même depuis une autre origine.
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok' });
});

app.use('/api/auth', routeurAuthentification);
app.use('/api/actifs', routeurActif);
app.use('/api/portefeuille', routeurPortefeuille);
app.use('/api/alertes', routeurAlerte);
app.use('/api/compte', routeurCompte);
app.use('/api/symboles', routeurSymbole);

// Toujours en dernier.
app.use(gestionErreurs);

module.exports = app;
