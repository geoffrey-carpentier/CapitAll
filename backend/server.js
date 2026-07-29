const config = require('./src/config');
const app = require('./src/app');
const { verifierConnexion } = require('./src/db');

app.listen(config.port, async () => {
  console.log(`Serveur CapitAll à l'écoute sur le port ${config.port}`);
  try {
    await verifierConnexion();
    console.log('Connexion PostgreSQL établie');
  } catch (erreur) {
    console.error('Connexion PostgreSQL indisponible au démarrage :', erreur.message);
  }
});
