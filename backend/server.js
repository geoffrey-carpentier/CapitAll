// Démarrage et arrêt du serveur.
//
// L'arrêt est traité ici et non dans app.js : c'est le processus qu'on arrête, pas
// l'application Express, qui doit rester montable en mémoire par les tests sans ouvrir
// de port ni poser d'écouteur de signal.
//
// POURQUOI UN ARRÊT ORDONNÉ. Sans écouteur de SIGTERM, `docker stop` laisse dix secondes
// puis envoie SIGKILL : les requêtes en cours sont coupées au milieu, et une transaction
// ouverte attend l'expiration de son verrou côté PostgreSQL. Ce qui suit ferme dans
// l'ordre inverse de l'ouverture — on cesse d'accepter, on laisse finir, puis on rend les
// connexions.
//
// POURQUOI UNE ÉCHÉANCE. `close()` attend la fin des requêtes en cours, et une connexion
// persistante inactive n'en est pas une : sans borne, une seule fenêtre de navigateur
// ouverte suffirait à retenir le processus indéfiniment. Les connexions inactives sont
// donc fermées tout de suite, les autres à l'échéance.

const config = require('./src/config');
const app = require('./src/app');
const { verifierConnexion, pool } = require('./src/db');
const cache = require('./src/cache/client');

// Au-delà, on ferme les connexions restantes plutôt que d'attendre encore. Dix secondes
// est le délai que Docker laisse par défaut avant SIGKILL : dépasser cette valeur
// reviendrait à confier l'arrêt à un signal qui ne laisse rien terminer du tout.
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
  // Un second signal ne relance pas la procédure : il la force.
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
  // La minuterie ne doit pas, à elle seule, maintenir le processus en vie.
  echeance.unref?.();

  // On cesse d'accepter, et on libère tout de suite ce qui n'est qu'une connexion
  // persistante inactive : elle n'a aucune requête à terminer.
  await new Promise((resolve) => {
    serveur.close(resolve);
    serveur.closeIdleConnections?.();
  });
  clearTimeout(echeance);

  // Les dépendances viennent après, jamais avant : les fermer d'abord ferait échouer
  // les requêtes qu'on vient précisément de laisser finir.
  await cache.fermer();

  try {
    await pool.end();
  } catch (erreur) {
    console.error("Fermeture du pool PostgreSQL :", erreur.message);
  }

  console.log('Arrêt terminé.');
  process.exit(0);
}

// SIGTERM est le signal de `docker stop` et des orchestrateurs ; SIGINT celui du Ctrl+C
// en développement. Les deux méritent le même traitement.
process.on('SIGTERM', () => arreter('SIGTERM'));
process.on('SIGINT', () => arreter('SIGINT'));

module.exports = { serveur, arreter };
