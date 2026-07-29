// Client Redis partagé. Ce module ne connaît rien aux cours : il gère uniquement la
// connexion, sa résilience et son arrêt. Les clés métier sont l'affaire de cacheCours.
//
// Principe directeur : le cache est une optimisation, jamais une dépendance dure.
// Aucune fonction d'ici ne propage d'exception à l'appelant. Si Redis est absent ou
// lent, l'application continue en interrogeant directement les fournisseurs de cours.

const { createClient } = require('redis');
const config = require('../config');

// Au-delà de ce délai, une opération de cache est abandonnée : attendre Redis plus
// longtemps que le fournisseur lui-même n'aurait aucun sens.
const DELAI_OPERATION_MS = 200;

const RECONNEXION_DELAI_INITIAL_MS = 200;
const RECONNEXION_DELAI_MAXIMAL_MS = 10000;

let client = null;
let connexionEnCours = null;
// Évite de répéter le même avertissement à chaque appel lorsque Redis est arrêté.
let indisponibiliteSignalee = false;

function creerClient() {
  const nouveauClient = createClient({
    url: config.redisUrl,
    socket: {
      // Recul progressif plafonné : sans plafond, les tentatives s'espaceraient
      // indéfiniment ; sans recul, elles saturerait le journal et le processeur.
      reconnectStrategy: (tentatives) =>
        Math.min(RECONNEXION_DELAI_INITIAL_MS * 2 ** tentatives, RECONNEXION_DELAI_MAXIMAL_MS),
    },
  });

  // Sans écouteur d'erreur, le client Redis émet une exception non gérée qui arrête
  // le processus : c'est exactement ce que l'on veut éviter.
  nouveauClient.on('error', (erreur) => {
    if (!indisponibiliteSignalee) {
      console.error('Cache Redis indisponible, repli sur les fournisseurs :', erreur.message);
      indisponibiliteSignalee = true;
    }
  });

  nouveauClient.on('ready', () => {
    if (indisponibiliteSignalee) {
      console.log('Cache Redis de nouveau disponible');
    }
    indisponibiliteSignalee = false;
  });

  return nouveauClient;
}

// Connexion paresseuse : le client n'est créé qu'au premier usage réel du cache, et
// une seule fois pour tout le processus.
async function obtenirClient() {
  if (!client) {
    client = creerClient();
  }

  if (!client.isOpen && !connexionEnCours) {
    connexionEnCours = client.connect().catch(() => null);
  }

  if (connexionEnCours) {
    await connexionEnCours;
    connexionEnCours = null;
  }

  // Le client a pu être fermé entre-temps : une opération abandonnée par le délai
  // poursuit son cours en arrière-plan et peut reprendre la main après fermer().
  if (!client) {
    return null;
  }

  return client.isReady ? client : null;
}

function estDisponible() {
  return Boolean(client && client.isReady);
}

// Enveloppe commune à toutes les opérations : borne la durée et absorbe les erreurs.
// Rend valeurParDefaut si le cache n'a pas répondu à temps ou a échoué.
//
// Le délai couvre la connexion autant que l'opération elle-même. C'est indispensable :
// lorsque Redis est arrêté, la tentative de connexion ne rend jamais la main, puisque
// le client retente indéfiniment en arrière-plan. Ne borner que l'opération laisserait
// l'appelant suspendu pour toujours.
function executer(operation, valeurParDefaut = null) {
  const tentative = (async () => {
    const connexion = await obtenirClient();
    if (!connexion) {
      return valeurParDefaut;
    }
    return operation(connexion);
  })().catch((erreur) => {
    console.error('Opération de cache abandonnée :', erreur.message);
    return valeurParDefaut;
  });

  const echeance = new Promise((resolve) => {
    const minuterie = setTimeout(() => resolve(valeurParDefaut), DELAI_OPERATION_MS);
    // Sans unref, cette minuterie maintiendrait le processus en vie jusqu'à son terme.
    minuterie.unref?.();
  });

  return Promise.race([tentative, echeance]);
}

// Fermeture propre : sans elle, le processus resterait suspendu à la connexion ouverte,
// ou aux tentatives de reconnexion si Redis est arrêté.
async function fermer() {
  if (!client) {
    return;
  }

  try {
    if (client.isReady) {
      // Connexion établie : on laisse Redis terminer les commandes en cours.
      await client.quit();
    } else {
      // Client en cours de reconnexion : quit() attendrait une connexion qui ne
      // viendra pas. La fermeture immédiate est ici le seul moyen de rendre la main.
      client.destroy();
    }
  } catch {
    // Une fermeture qui échoue ne doit jamais empêcher l'arrêt du processus.
  }

  client = null;
  connexionEnCours = null;
}

module.exports = { obtenirClient, estDisponible, executer, fermer, DELAI_OPERATION_MS };
