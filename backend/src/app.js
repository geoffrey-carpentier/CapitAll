const express = require('express');
const cors = require('cors');

const routeurAuthentification = require('./routes/authentification');
const routeurActif = require('./routes/actif');
const gestionErreurs = require('./middlewares/gestionErreurs');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok' });
});

app.use('/api/auth', routeurAuthentification);
app.use('/api/actifs', routeurActif);

// Toujours en dernier : Express n'y passe que si une route a appelé next(erreur).
app.use(gestionErreurs);

module.exports = app;
