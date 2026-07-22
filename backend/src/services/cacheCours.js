// Cache Redis pour les cours récupérés auprès des fournisseurs externes (D14).
// Le service de cours interroge ce cache avant d'appeler un adaptateur ; il y écrit
// systématiquement le résultat d'un appel réussi, avec une durée de vie courte.
// Dépendance : paquet npm "redis" (client officiel, v4+). URL de connexion fournie
// par la variable d'environnement REDIS_URL (ex. redis://redis:6379 en docker-compose).

const { createClient } = require('redis');

const DUREE_VIE_SECONDES = 120;
const PREFIXE_CLE = 'cours';

let client;

function obtenirClient() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (erreur) => {
      console.error('Erreur de connexion Redis', erreur);
    });
  }
  return client;
}

async function connecter() {
  const c = obtenirClient();
  if (!c.isOpen) {
    await c.connect();
  }
  return c;
}

function construireCle(symbole) {
  return `${PREFIXE_CLE}:${symbole.toUpperCase()}`;
}

// Renvoie { symbole, cours_eur, horodatage } si le cours est en cache, sinon null.
// Ne lève jamais d'exception : une indisponibilité de Redis doit dégrader vers un
// appel direct au fournisseur, pas faire échouer la requête de l'utilisateur.
async function lireCoursCache(symbole) {
  try {
    const c = await connecter();
    const valeur = await c.get(construireCle(symbole));
    return valeur ? JSON.parse(valeur) : null;
  } catch (erreur) {
    console.error(`Lecture cache impossible pour ${symbole}`, erreur);
    return null;
  }
}

// Écrit le cours en cache avec la durée de vie par défaut. Échec silencieux pour
// la même raison que lireCoursCache : le cache est une optimisation, pas une
// dépendance dure du calcul de portefeuille.
async function ecrireCoursCache(symbole, cours) {
  try {
    const c = await connecter();
    await c.set(construireCle(symbole), JSON.stringify(cours), {
      EX: DUREE_VIE_SECONDES,
    });
  } catch (erreur) {
    console.error(`Écriture cache impossible pour ${symbole}`, erreur);
  }
}

// Dernier cours connu, même expiré, utilisé en repli quand un fournisseur est
// indisponible (cas-utilisation.md : "le dernier cours connu est affiché avec sa date").
// Repose sur une seconde clé à durée de vie longue, mise à jour à chaque écriture réussie.
async function lireDernierCoursConnu(symbole) {
  try {
    const c = await connecter();
    const valeur = await c.get(`${PREFIXE_CLE}:dernier-connu:${symbole.toUpperCase()}`);
    return valeur ? JSON.parse(valeur) : null;
  } catch (erreur) {
    console.error(`Lecture du dernier cours connu impossible pour ${symbole}`, erreur);
    return null;
  }
}

async function ecrireDernierCoursConnu(symbole, cours) {
  try {
    const c = await connecter();
    // Pas de TTL ici : cette clé sert de filet de sécurité de longue durée,
    // remplacée à chaque nouvel appel fournisseur réussi.
    await c.set(`${PREFIXE_CLE}:dernier-connu:${symbole.toUpperCase()}`, JSON.stringify(cours));
  } catch (erreur) {
    console.error(`Écriture du dernier cours connu impossible pour ${symbole}`, erreur);
  }
}

module.exports = {
  lireCoursCache,
  ecrireCoursCache,
  lireDernierCoursConnu,
  ecrireDernierCoursConnu,
};
