// Sérialisation CSV, en module pur.
//
// Séparateur point-virgule : les tableurs francophones ouvriraient un fichier séparé par
// des virgules en une seule colonne.

const SEPARATEUR = ';';

// Caractères qui ouvrent une formule dans un tableur : un champ qui commence par l'un
// d'eux est préfixé d'une apostrophe (protection contre l'injection de formule).
const AMORCES_DE_FORMULE = ['=', '+', '-', '@', '\t', '\r'];

function neutraliserFormule(valeur) {
  if (valeur.length > 0 && AMORCES_DE_FORMULE.includes(valeur[0])) {
    return `'${valeur}`;
  }
  return valeur;
}

// RFC 4180 : guillemets seulement si nécessaire, guillemet interne doublé.
function echapper(valeur) {
  const texte = valeur === null || valeur === undefined ? '' : String(valeur);
  const neutralise = neutraliserFormule(texte);

  if (
    neutralise.includes(SEPARATEUR) ||
    neutralise.includes('"') ||
    neutralise.includes('\n') ||
    neutralise.includes('\r')
  ) {
    return `"${neutralise.replace(/"/g, '""')}"`;
  }

  return neutralise;
}

function ligne(valeurs) {
  return valeurs.map(echapper).join(SEPARATEUR);
}

// Fins de ligne CRLF (RFC 4180), y compris après la dernière ligne.
function construire(entetes, lignes) {
  return [ligne(entetes), ...lignes.map(ligne)].join('\r\n') + '\r\n';
}

module.exports = { SEPARATEUR, echapper, ligne, construire };
