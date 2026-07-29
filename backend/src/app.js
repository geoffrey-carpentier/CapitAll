const express = require('express');
const cors = require('cors');

const gestionErreurs = require('./middlewares/gestionErreurs');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok' });
});

// Toujours en dernier : Express n'y passe que si une route a appelé next(erreur).
app.use(gestionErreurs);

module.exports = app;
