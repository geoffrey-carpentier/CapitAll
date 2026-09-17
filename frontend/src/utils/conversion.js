// Conversion d'un montant de l'euro vers le dollar, pour l'affichage seulement.
//
// Seule opération de calcul côté interface : la bascule de devise ne doit déclencher
// aucune requête, le taux étant déjà dans la réponse du portefeuille. Tout le reste est
// calculé par le serveur ; ne pas ajouter d'autre arithmétique ici.
//
// La multiplication se fait en BigInt, à l'échelle de chaque chaîne, sans flottant.

// Le résultat n'a jamais moins de deux décimales.
const DECIMALES_MINIMALES = 2;

// Toute la précision du taux transmis est conservée (échelle des taux du serveur).
const DECIMALES_TAUX = 18;

const CHIFFRES = /^-?\d+(\.\d+)?$/;

function decimalesDe(valeur) {
  const [, decimale = ''] = valeur.split('.');
  return decimale.length;
}

// Chaîne décimale vers entier à l'échelle demandée ; les décimales excédentaires sont
// tronquées.
function versEntier(valeur, decimales) {
  const negatif = valeur.startsWith('-');
  const [entiere, decimale = ''] = (negatif ? valeur.slice(1) : valeur).split('.');
  const ajustee = decimale.padEnd(decimales, '0').slice(0, decimales);
  const entier = BigInt(entiere) * 10n ** BigInt(decimales) + BigInt(ajustee || '0');

  return negatif ? -entier : entier;
}

// Entier vers chaîne à nombre fixe de décimales. Les zéros de fin sont conservés : le
// résultat a la forme des montants du serveur, ce qui permet au jeu d'essai partagé de
// comparer les deux implémentations chaîne à chaîne.
function versChaine(entier, decimales) {
  const negatif = entier < 0n;
  const absolu = negatif ? -entier : entier;
  const facteur = 10n ** BigInt(decimales);

  const partieEntiere = absolu / facteur;
  const partieDecimale = (absolu % facteur).toString().padStart(decimales, '0');

  return `${negatif ? '-' : ''}${partieEntiere}.${partieDecimale}`;
}

// Applique un taux à un montant, tous deux en chaînes.
//
// Le résultat garde autant de décimales que le montant reçu, jamais moins de deux, pour
// qu'un cours très faible ne devienne pas nul. L'arrondi est au plus proche, les demis
// s'éloignant de zéro : c'est la règle du serveur, et deux règles différentes
// produiraient des écarts d'un centime.
export function convertir(montant, taux) {
  if (typeof montant !== 'string' || !CHIFFRES.test(montant)) {
    return null;
  }
  if (typeof taux !== 'string' || !CHIFFRES.test(taux)) {
    return null;
  }

  const decimalesSortie = Math.max(DECIMALES_MINIMALES, decimalesDe(montant));

  const produit = versEntier(montant, decimalesSortie) * versEntier(taux, DECIMALES_TAUX);
  const facteur = 10n ** BigInt(DECIMALES_TAUX);

  const quotient = produit / facteur;
  const reste = produit % facteur;
  const resteAbsolu = reste < 0n ? -reste : reste;

  if (resteAbsolu * 2n < facteur) {
    return versChaine(quotient, decimalesSortie);
  }

  return versChaine(quotient + (produit < 0n ? -1n : 1n), decimalesSortie);
}
