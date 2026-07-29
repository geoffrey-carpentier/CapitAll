// Arithmétique décimale exacte, en entiers.
//
// Aucun montant du projet n'est calculé en virgule flottante (D4). Un nombre est
// représenté par un entier BigInt exprimé dans une unité fixe : à l'échelle 8, la
// valeur 1,5 est portée par l'entier 150000000. Les additions et soustractions sont
// alors exactes, et 0,1 + 0,2 rend exactement 0,3 là où le flottant donnerait
// 0,30000000000000004.
//
// Échelles retenues, alignées sur les colonnes du schéma PostgreSQL :
//   - quantités      : 8 décimales, comme NUMERIC(24,8) de transaction.quantite ;
//   - prix, montants : 2 décimales, comme NUMERIC(18,2) de transaction.prix_unitaire ;
//   - PRU            : 8 décimales. Le PRU n'est pas un prix affiché mais un diviseur
//                      de calcul : arrondi à 2 décimales, il fausserait la plus-value
//                      d'un actif coté très haut ou très bas. Un PRU de bitcoin à
//                      deux décimales, ou celui d'un jeton à 0,00000012 euro, serait
//                      inexploitable.
//
// Règle d'arrondi de la division : arrondi au plus proche, les demis s'éloignant de
// zéro (« demi-supérieur en valeur absolue »). C'est la règle usuelle en comptabilité,
// et elle traite symétriquement les gains et les pertes.

const ECHELLE_QUANTITE = 8;
const ECHELLE_MONTANT = 2;
const ECHELLE_PRU = 8;

function facteur(echelle) {
  return 10n ** BigInt(echelle);
}

// Accepte une chaîne ou un nombre, rend l'entier correspondant à l'échelle demandée.
// Les décimales au-delà de l'échelle sont tronquées : elles ne sont pas représentables.
function versUnites(valeur, echelle) {
  const texte = String(valeur).trim();
  const negatif = texte.startsWith('-');
  const [entier, decimales = ''] = (negatif ? texte.slice(1) : texte).split('.');

  const decimalesAjustees = decimales.padEnd(echelle, '0').slice(0, echelle);
  const unites = BigInt(entier || '0') * facteur(echelle) + BigInt(decimalesAjustees || '0');

  return negatif ? -unites : unites;
}

// Rend la représentation textuelle, sans zéros décimaux inutiles.
function versChaine(unites, echelle) {
  const negatif = unites < 0n;
  const absolu = negatif ? -unites : unites;

  const partieEntiere = absolu / facteur(echelle);
  const partieDecimale = (absolu % facteur(echelle))
    .toString()
    .padStart(echelle, '0')
    .replace(/0+$/, '');

  return `${negatif ? '-' : ''}${partieEntiere}${partieDecimale ? `.${partieDecimale}` : ''}`;
}

// Rend la valeur avec un nombre fixe de décimales, pour l'affichage d'un montant.
function formater(unites, echelle, decimales) {
  const arrondi = convertirEchelle(unites, echelle, decimales);
  const negatif = arrondi < 0n;
  const absolu = negatif ? -arrondi : arrondi;

  const partieEntiere = absolu / facteur(decimales);
  const partieDecimale = (absolu % facteur(decimales)).toString().padStart(decimales, '0');

  return `${negatif ? '-' : ''}${partieEntiere}${decimales > 0 ? `.${partieDecimale}` : ''}`;
}

// Division entière arrondie au plus proche, les demis s'éloignant de zéro.
function diviserEntiers(numerateur, denominateur) {
  if (denominateur === 0n) {
    throw new Error('Division par zéro dans un calcul décimal.');
  }

  const quotient = numerateur / denominateur;
  const reste = numerateur % denominateur;

  if (reste === 0n) {
    return quotient;
  }

  const resteDouble = (reste < 0n ? -reste : reste) * 2n;
  const denominateurAbsolu = denominateur < 0n ? -denominateur : denominateur;

  if (resteDouble < denominateurAbsolu) {
    return quotient;
  }

  const memeSigne = numerateur < 0n === denominateur < 0n;
  return memeSigne ? quotient + 1n : quotient - 1n;
}

// Passe une valeur d'une échelle à une autre, en arrondissant si l'échelle diminue.
function convertirEchelle(unites, echelleSource, echelleCible) {
  if (echelleCible === echelleSource) {
    return unites;
  }
  if (echelleCible > echelleSource) {
    return unites * facteur(echelleCible - echelleSource);
  }
  return diviserEntiers(unites, facteur(echelleSource - echelleCible));
}

function additionner(a, b) {
  return a + b;
}

function soustraire(a, b) {
  return a - b;
}

// Les deux opérandes sont à la même échelle : leur produit est à l'échelle double,
// il faut donc le ramener à l'échelle voulue.
function multiplier(a, b, echelle) {
  return diviserEntiers(a * b, facteur(echelle));
}

// Même raisonnement en sens inverse : le numérateur est remonté d'une échelle avant
// division, pour que le quotient soit lui-même à l'échelle voulue.
function diviser(a, b, echelle) {
  return diviserEntiers(a * facteur(echelle), b);
}

function comparer(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function estZero(unites) {
  return unites === 0n;
}

module.exports = {
  ECHELLE_QUANTITE,
  ECHELLE_MONTANT,
  ECHELLE_PRU,
  versUnites,
  versChaine,
  formater,
  convertirEchelle,
  additionner,
  soustraire,
  multiplier,
  diviser,
  comparer,
  estZero,
};
