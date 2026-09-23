// Cache Redis des cours : les clés et leur durée de vie. La connexion relève de
// src/cache/client.js.
//
//   cours:v2:{TYPE}:{SYMBOLE}                avec TTL, le cours frais servi en priorité
//   cours:v2:dernier-connu:{TYPE}:{SYMBOLE}  sans TTL, repli quand un fournisseur
//                                            est indisponible
//
// Un cours s'identifie par (type, symbole) : un même sigle peut désigner des
// instruments de classes différentes, et le cache est commun à tous les comptes.
// Aucune fonction ne lève d'exception : une panne de cache dégrade vers un appel direct
// au fournisseur.
//
// Le préfixe porte une version. Les clés de l'ancien format ne sont plus lues : celles
// qui ont un TTL expirent d'elles-mêmes, celles du dernier cours connu n'en ont pas et
// restent jusqu'à un inventaire explicitement autorisé. En exploitation, ne pas purger
// « cours:*dernier-connu:* » au motif d'un nettoyage : c'est le filet de sécurité des
// cours, et il emporterait les clés courantes avec les anciennes.

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

// La durée de vie est reçue en paramètre : elle dépend de la classe d'actif, le
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
