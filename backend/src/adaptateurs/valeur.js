// Lecture d'une valeur numérique venue d'un fournisseur.
//
// Le client HTTP rend désormais les littéraux numériques sous forme de chaînes, pour ne
// pas perdre les chiffres exacts à l'analyse du JSON. Les adaptateurs reçoivent donc des
// chaînes en production. Leurs tests, eux, injectent souvent des nombres écrits
// directement dans une fixture, et il n'y a aucune raison de les contraindre à écrire
// des chaînes pour satisfaire une mécanique interne : les deux formes sont acceptées.
//
// Une valeur reçue sous forme de nombre a déjà perdu ce qui dépassait la capacité d'un
// flottant. Rien ne le rattrape ici : le rôle de cette fonction est de rendre la
// meilleure écriture décimale disponible, pas de prétendre reconstituer une précision
// perdue en amont.

const { versNotationPositionnelle } = require('../utils/decimal');

const MOTIF_DECIMAL = /^-?\d+(\.\d+)?$/;

// Rend une chaîne décimale exploitable, ou null si la valeur ne l'est pas.
function chaineDecimale(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return null;
  }

  const texte = versNotationPositionnelle(String(valeur).trim());
  return MOTIF_DECIMAL.test(texte) ? texte : null;
}

// Même lecture, restreinte aux valeurs strictement positives : un cours nul ou négatif
// n'est pas une cotation, c'est une réponse à écarter.
function chaineDecimalePositive(valeur) {
  const texte = chaineDecimale(valeur);

  if (texte === null || texte.startsWith('-') || !/[1-9]/.test(texte)) {
    return null;
  }

  return texte;
}

module.exports = { chaineDecimale, chaineDecimalePositive };
