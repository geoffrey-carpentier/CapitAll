// Lecture d'une valeur numérique venue d'un fournisseur.
//
// En production, le client HTTP rend des chaînes ; les tests injectent souvent des
// nombres. Les deux formes sont acceptées, mais un nombre a déjà perdu la précision au-delà
// d'un flottant.

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
// est écarté.
function chaineDecimalePositive(valeur) {
  const texte = chaineDecimale(valeur);

  if (texte === null || texte.startsWith('-') || !/[1-9]/.test(texte)) {
    return null;
  }

  return texte;
}

module.exports = { chaineDecimale, chaineDecimalePositive };
