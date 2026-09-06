// Sérialisation CSV. Module pur : il reçoit des valeurs, il rend une chaîne, sans
// connaître ni les mouvements ni HTTP.
//
// Le séparateur est le point-virgule et non la virgule : les montants du domaine sont
// écrits avec un point décimal, mais les tableurs francophones ouvrent un fichier
// séparé par des virgules en une seule colonne. Le point-virgule est ce qu'ils
// attendent, et il reste conforme au RFC 4180, qui n'impose pas la virgule.

const SEPARATEUR = ';';

// Caractères qui ouvrent une formule dans Excel, LibreOffice et Google Sheets. Un champ
// qui commence par l'un d'eux est interprété comme du calcul et non comme du texte :
// exporté tel quel, un symbole d'actif nommé « =1+1 » s'exécuterait à l'ouverture du
// fichier. Le seul champ réellement saisi par l'utilisateur est le symbole, mais la
// garde est posée pour tous, une colonne pouvant en devenir une demain.
const AMORCES_DE_FORMULE = ['=', '+', '-', '@', '\t', '\r'];

function neutraliserFormule(valeur) {
  if (valeur.length > 0 && AMORCES_DE_FORMULE.includes(valeur[0])) {
    return `'${valeur}`;
  }
  return valeur;
}

// Règle RFC 4180 : un champ n'est encadré que s'il en a besoin, et le guillemet se
// protège en le doublant. Encadrer systématiquement serait valide mais rendrait le
// fichier illisible à l'oeil, alors qu'il a vocation à être ouvert et relu.
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

// Fin de ligne CRLF, celle que le RFC 4180 prescrit et que les tableurs Windows
// attendent. Le fichier se termine par un saut de ligne, y compris quand il ne porte
// que son en-tête.
function construire(entetes, lignes) {
  return [ligne(entetes), ...lignes.map(ligne)].join('\r\n') + '\r\n';
}

module.exports = { SEPARATEUR, echapper, ligne, construire };
