// Cache Redis des cours récupérés auprès des fournisseurs externes (D14).
// Ce module ne gère que les clés et leur durée de vie ; la connexion et sa résilience
// sont l'affaire de src/cache/client.js.
//
// Deux familles de clés, aux rôles distincts :
//   cours:v2:{TYPE}:{SYMBOLE}                avec TTL, le cours frais servi en priorité
//   cours:v2:dernier-connu:{TYPE}:{SYMBOLE}  sans TTL, filet de sécurité quand un
//                                            fournisseur est indisponible
//                                            (cas-utilisation.md : « le dernier cours
//                                            connu est affiché avec sa date »)
//
// L'identité d'un cours est le couple (type, symbole), jamais le symbole seul. Un même
// sigle désigne des instruments différents selon la classe : ETH est une cryptomonnaie,
// et rien n'empêche de suivre une devise portant le même code. Avec le symbole pour
// seule clé, le cours de l'une était servi pour l'autre, y compris sur le repli, et
// l'unicité (utilisateur_id, symbole) de la base n'y changeait rien : le cache est
// commun à tous les comptes.
//
// Le préfixe porte une version. Les clés de l'ancien format ne sont plus lues et
// expireront d'elles-mêmes pour les cours frais ; celles du dernier cours connu, qui
// n'ont pas de durée de vie, resteront jusqu'à un inventaire et une suppression
// explicitement autorisés. Purger « cours:dernier-connu:* » aurait emporté les
// nouvelles clés en même temps que les anciennes.
//
// Aucune fonction ne lève d'exception : une panne de cache dégrade vers un appel
// direct au fournisseur, elle ne fait jamais échouer la requête de l'utilisateur.

const cache = require('../cache/client');

const PREFIXE_CLE = 'cours:v2';

function construireCle(type, symbole) {
  return `${PREFIXE_CLE}:${type}:${symbole.toUpperCase()}`;
}

function construireCleDernierConnu(type, symbole) {
  return `${PREFIXE_CLE}:dernier-connu:${type}:${symbole.toUpperCase()}`;
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

async function lireCoursCache(type, symbole) {
  const valeur = await cache.executer((client) => client.get(construireCle(type, symbole)));
  return analyser(valeur);
}

// La durée de vie est reçue en paramètre : elle dépend de la classe d'actif (D21), le
// service de cours étant seul à connaître le type du symbole demandé.
async function ecrireCoursCache(type, symbole, cours, dureeVieSecondes) {
  await cache.executer((client) =>
    client.set(construireCle(type, symbole), JSON.stringify(cours), { EX: dureeVieSecondes })
  );
}

async function lireDernierCoursConnu(type, symbole) {
  const valeur = await cache.executer((client) =>
    client.get(construireCleDernierConnu(type, symbole))
  );
  return analyser(valeur);
}

// Pas de TTL sur cette clé : elle sert de filet de sécurité de longue durée, remplacée
// à chaque appel réussi d'un fournisseur.
async function ecrireDernierCoursConnu(type, symbole, cours) {
  await cache.executer((client) =>
    client.set(construireCleDernierConnu(type, symbole), JSON.stringify(cours))
  );
}

module.exports = {
  lireCoursCache,
  ecrireCoursCache,
  lireDernierCoursConnu,
  ecrireDernierCoursConnu,
};
