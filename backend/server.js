require('dotenv').config();

const app = require('./src/app');
const { verifierConnexion } = require('./src/db');

const port = process.env.PORT || 5000;

app.listen(port, async () => {
  console.log(`Serveur CapitAll à l'écoute sur le port ${port}`);
  try {
    await verifierConnexion();
    console.log('Connexion PostgreSQL établie');
  } catch (erreur) {
    console.error('Connexion PostgreSQL indisponible au démarrage :', erreur.message);
  }
});
