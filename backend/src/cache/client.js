// Client Redis partagé : connexion, résilience et arrêt. Les clés métier relèvent de
// cacheCours.
//
// Le cache est une optimisation, jamais une dépendance : aucune fonction ne propage
// d'exception, et sans Redis l'application interroge directement les fournisseurs.

const { createClient } = require('redis');
const config = require('../config');

// Au-delà, l'opération de cache est abandonnée.
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
      // Recul exponentiel plafonné.
      reconnectStrategy: (tentatives) =>
        Math.min(RECONNEXION_DELAI_INITIAL_MS * 2 ** tentatives, RECONNEXION_DELAI_MAXIMAL_MS),
    },
  });

  // Sans écouteur d'erreur, le client émettrait une exception non gérée qui arrêterait
  // le processus.
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

// Connexion paresseuse, une seule fois pour tout le processus.
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

  // Le client a pu être fermé entre-temps par une opération abandonnée au délai.
  if (!client) {
    return null;
  }

  return client.isReady ? client : null;
}

function estDisponible() {
  return Boolean(client && client.isReady);
}

// Borne la durée et absorbe les erreurs ; rend valeurParDefaut en cas d'échec ou de
// dépassement. Le délai couvre aussi la connexion, qui ne rend jamais la main quand
// Redis est arrêté.
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
    // unref : la minuterie ne retient pas le processus.
    minuterie.unref?.();
  });

  return Promise.race([tentative, echeance]);
}

// Fermeture propre, sans laquelle le processus resterait suspendu à la connexion ou aux
// reconnexions.
async function fermer() {
  if (!client) {
    return;
  }

  try {
    if (client.isReady) {
      // Connexion établie : Redis termine les commandes en cours.
      await client.quit();
    } else {
      // En reconnexion, quit() attendrait indéfiniment : fermeture immédiate.
      client.destroy();
    }
  } catch {
    // Un échec de fermeture ne doit pas empêcher l'arrêt du processus.
  }

  client = null;
  connexionEnCours = null;
}

module.exports = { obtenirClient, estDisponible, executer, fermer, DELAI_OPERATION_MS };
