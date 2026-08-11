// Conversion d'un montant à l'affichage, du seul euro vers le dollar.
//
// Portée volontairement étroite. Le calcul du patrimoine appartient au serveur, qui
// dispose du moteur exact et de ses six règles ; rien de ce qui est calculé là-bas
// n'est recalculé ici. La seule exception est cette conversion, et elle tient à une
// contrainte d'ergonomie : la bascule euro-dollar ne doit déclencher aucune requête,
// le taux étant déjà dans la réponse du portefeuille.
//
// Une multiplication exacte suffit donc, et c'est tout ce que ce fichier contient. Y
// ajouter une division, une addition, ou porter ici l'arithmétique du serveur ferait
// vivre la logique de calcul en deux exemplaires, avec la certitude qu'elles finiraient
// par diverger.
//
// La multiplication se fait en entiers : les deux chaînes sont transformées en BigInt à
// leur échelle, multipliées, puis ramenées à deux décimales. Aucun flottant n'entre dans
// la chaîne, conformément à la politique de formatage.

const DECIMALES_MONTANT = 2;

// Un taux de change porte quatre décimales à l'affichage, mais le serveur en transmet
// davantage. On garde toute la précision reçue : la tronquer ferait dériver la somme
// d'une colonne convertie.
const DECIMALES_TAUX = 12;

const CHIFFRES = /^-?\d+(\.\d+)?$/;

// Chaîne décimale vers entier à l'échelle demandée. Les décimales excédentaires sont
// tronquées : elles ne sont pas représentables à cette échelle.
function versEntier(valeur, decimales) {
  const negatif = valeur.startsWith('-');
  const [entiere, decimale = ''] = (negatif ? valeur.slice(1) : valeur).split('.');
  const ajustee = decimale.padEnd(decimales, '0').slice(0, decimales);
  const entier = BigInt(entiere) * 10n ** BigInt(decimales) + BigInt(ajustee || '0');

  return negatif ? -entier : entier;
}

// Entier vers chaîne décimale, sans zéros de fin inutiles.
function versChaine(entier, decimales) {
  const negatif = entier < 0n;
  const absolu = negatif ? -entier : entier;
  const facteur = 10n ** BigInt(decimales);

  const partieEntiere = absolu / facteur;
  const partieDecimale = (absolu % facteur).toString().padStart(decimales, '0').replace(/0+$/, '');

  return `${negatif ? '-' : ''}${partieEntiere}${partieDecimale ? `.${partieDecimale}` : ''}`;
}

// Applique un taux de change à un montant, les deux étant des chaînes.
//
// Le résultat est arrondi au centime, au plus proche, les demis s'éloignant de zéro :
// c'est la règle du serveur, et deux règles d'arrondi différentes dans une même
// application produiraient des écarts d'un centime impossibles à expliquer.
export function convertir(montant, taux) {
  if (typeof montant !== 'string' || !CHIFFRES.test(montant)) {
    return null;
  }
  if (typeof taux !== 'string' || !CHIFFRES.test(taux)) {
    return null;
  }

  const produit = versEntier(montant, DECIMALES_MONTANT) * versEntier(taux, DECIMALES_TAUX);
  const facteur = 10n ** BigInt(DECIMALES_TAUX);

  const quotient = produit / facteur;
  const reste = produit % facteur;
  const resteAbsolu = reste < 0n ? -reste : reste;

  // Arrondi au plus proche : on regarde si le reste atteint la moitié du diviseur.
  if (resteAbsolu * 2n < facteur) {
    return versChaine(quotient, DECIMALES_MONTANT);
  }

  return versChaine(quotient + (produit < 0n ? -1n : 1n), DECIMALES_MONTANT);
}
