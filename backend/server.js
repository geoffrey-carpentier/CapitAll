// Démarrage et arrêt du serveur. L'arrêt est géré ici et non dans app.js, que les tests
// montent en mémoire sans port ni écouteur de signal.
//
// Arrêt ordonné : sans lui, `docker stop` coupe les requêtes en cours au bout de dix
// secondes (SIGKILL). On cesse d'accepter, on laisse finir, puis on ferme cache et base.
// Les connexions persistantes inactives sont fermées tout de suite, les autres à
// l'échéance, sans quoi un navigateur ouvert retiendrait le processus.

const config = require('./src/config');
const app = require('./src/app');
const { verifierConnexion, pool } = require('./src/db');
const cache = require('./src/cache/client');

// Inférieur aux dix secondes que Docker laisse avant SIGKILL.
const DELAI_ARRET_MS = 8000;

const serveur = app.listen(config.port, async () => {
  console.log(`Serveur WalletWatch à l'écoute sur le port ${config.port}`);
  try {
    await verifierConnexion();
    console.log('Connexion PostgreSQL établie');
  } catch (erreur) {
    console.error('Connexion PostgreSQL indisponible au démarrage :', erreur.message);
  }
});

let arretEnCours = false;

async function arreter(signal) {
  // Un second signal force l'arrêt.
  if (arretEnCours) {
    console.warn(`${signal} reçu pendant l'arrêt : fermeture immédiate.`);
    process.exit(1);
  }
  arretEnCours = true;
  console.log(`${signal} reçu, arrêt en cours.`);

  const echeance = setTimeout(() => {
    console.warn("Requêtes encore en cours à l'échéance : fermeture des connexions restantes.");
    serveur.closeAllConnections?.();
  }, DELAI_ARRET_MS);
  // unref : la minuterie ne retient pas le processus.
  echeance.unref?.();

  // Plus de nouvelles connexions ; les connexions inactives sont libérées tout de suite.
  await new Promise((resolve) => {
    serveur.close(resolve);
    serveur.closeIdleConnections?.();
  });
  clearTimeout(echeance);

  // Cache et base ensuite seulement, pour ne pas faire échouer les requêtes terminées.
  await cache.fermer();

  try {
    await pool.end();
  } catch (erreur) {
    console.error("Fermeture du pool PostgreSQL :", erreur.message);
  }

  console.log('Arrêt terminé.');
  process.exit(0);
}

// SIGTERM : `docker stop` ; SIGINT : Ctrl+C en développement.
process.on('SIGTERM', () => arreter('SIGTERM'));
process.on('SIGINT', () => arreter('SIGINT'));

module.exports = { serveur, arreter };
