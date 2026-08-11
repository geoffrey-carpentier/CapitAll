const express = require('express');
const cors = require('cors');
const config = require('./config');

const routeurAuthentification = require('./routes/authentification');
const routeurActif = require('./routes/actif');
const routeurPortefeuille = require('./routes/portefeuille');
const routeurAlerte = require('./routes/alerte');
const gestionErreurs = require('./middlewares/gestionErreurs');

const app = express();

// Seule l'origine de l'interface est autorisée (exigence du cahier des charges).
// Ouvrir l'API à toutes les origines laisserait n'importe quelle page tierce appeler
// le service depuis le navigateur d'un utilisateur connecté. L'en-tête d'autorisation
// est explicitement admis, sans quoi le jeton ne pourrait pas être transmis.
app.use(
  cors({
    origin: config.origineAutorisee,
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Toujours en dernier : Express n'y passe que si une route a appelé next(erreur).
app.use(gestionErreurs);

module.exports = app;
