// Cache Redis des cours récupérés auprès des fournisseurs externes (D14).
// Ce module ne gère que les clés et leur durée de vie ; la connexion et sa résilience
// sont l'affaire de src/cache/client.js.
//
// Deux familles de clés, aux rôles distincts :
//   cours:{SYMBOLE}                avec TTL, le cours frais servi en priorité
//   cours:dernier-connu:{SYMBOLE}  sans TTL, filet de sécurité quand un fournisseur
//                                  est indisponible (cas-utilisation.md : « le dernier
//                                  cours connu est affiché avec sa date »)
//
// Aucune fonction ne lève d'exception : une panne de cache dégrade vers un appel
// direct au fournisseur, elle ne fait jamais échouer la requête de l'utilisateur.

const cache = require('../cache/client');

const PREFIXE_CLE = 'cours';

function construireCle(symbole) {
  return `${PREFIXE_CLE}:${symbole.toUpperCase()}`;
}

function construireCleDernierConnu(symbole) {
  return `${PREFIXE_CLE}:dernier-connu:${symbole.toUpperCase()}`;
}

function analyser(valeur) {
  if (!valeur) {
    return null;
  }
  try {
    return JSON.parse(valeur);
  } catch {
    // Une valeur illisible est traitée comme une absence de cache plutôt que comme
    // une erreur : le cours sera simplement redemandé au fournisseur.
    return null;
  }
}

async function lireCoursCache(symbole) {
  const valeur = await cache.executer((client) => client.get(construireCle(symbole)));
  return analyser(valeur);
}

// La durée de vie est désormais reçue en paramètre : elle dépend de la classe d'actif
// (D21), le service de cours étant seul à connaître le type du symbole demandé.
async function ecrireCoursCache(symbole, cours, dureeVieSecondes) {
  await cache.executer((client) =>
    client.set(construireCle(symbole), JSON.stringify(cours), { EX: dureeVieSecondes })
  );
}

async function lireDernierCoursConnu(symbole) {
  const valeur = await cache.executer((client) => client.get(construireCleDernierConnu(symbole)));
  return analyser(valeur);
}

// Pas de TTL sur cette clé : elle sert de filet de sécurité de longue durée, remplacée
// à chaque appel réussi d'un fournisseur.
async function ecrireDernierCoursConnu(symbole, cours) {
  await cache.executer((client) =>
    client.set(construireCleDernierConnu(symbole), JSON.stringify(cours))
  );
}

module.exports = {
  lireCoursCache,
  ecrireCoursCache,
  lireDernierCoursConnu,
  ecrireDernierCoursConnu,
};
