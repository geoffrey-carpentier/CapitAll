// Arithmétique décimale exacte, en entiers.
//
// Aucun montant n'est calculé en virgule flottante. Un nombre est un entier BigInt
// exprimé dans une unité fixe : à l'échelle 8, 1,5 est porté par 150000000, et
// 0,1 + 0,2 rend exactement 0,3.
//
// Échelles :
//   quantités, frais en nature, prix, cours, taux : 18 décimales (le wei d'Ethereum,
//       et assez de chiffres significatifs pour un cours très faible) ;
//   prix de revient : 24 décimales, car c'est un diviseur réinjecté dans les calculs ;
//   montants en euros : 2 décimales.
//
// Arrondi unique : au plus proche, les demis s'éloignant de zéro, à la lecture comme
// au calcul. multiplier et diviser reçoivent explicitement l'échelle de chaque opérande
// et celle du résultat.

const ECHELLE_QUANTITE = 18;
const ECHELLE_PRIX = 18;
const ECHELLE_PRU = 24;
const ECHELLE_TAUX = 18;
const ECHELLE_MONTANT = 2;
const ECHELLE_POURCENTAGE = 2;

function facteur(echelle) {
  return 10n ** BigInt(echelle);
}

// Notation scientifique vers notation positionnelle.
//
// JavaScript écrit en exposant tout nombre inférieur à 1e-6 (String(1e-7) rend « 1e-7 »),
// ce que le constructeur BigInt refuse.
function versNotationPositionnelle(texte) {
  const correspondance = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(texte);

  if (!correspondance) {
    return texte;
  }

  const [, signe, entiere, decimale = '', exposant] = correspondance;
  const chiffres = `${entiere}${decimale}`;
  // Position de la virgule après application de l'exposant, comptée depuis la gauche.
  const virgule = entiere.length + Number(exposant);

  if (virgule <= 0) {
    return `${signe}0.${'0'.repeat(-virgule)}${chiffres}`;
  }
  if (virgule >= chiffres.length) {
    return `${signe}${chiffres}${'0'.repeat(virgule - chiffres.length)}`;
  }
  return `${signe}${chiffres.slice(0, virgule)}.${chiffres.slice(virgule)}`;
}

// Accepte une chaîne ou un nombre, rend l'entier correspondant à l'échelle demandée.
// Les décimales au-delà de l'échelle sont arrondies au plus proche.
function versUnites(valeur, echelle) {
  const texte = versNotationPositionnelle(String(valeur).trim());
  const negatif = texte.startsWith('-');
  const [entier, decimales = ''] = (negatif ? texte.slice(1) : texte).replace(/^\+/, '').split('.');

  const conservees = decimales.padEnd(echelle, '0').slice(0, echelle);
  let unites = BigInt(entier || '0') * facteur(echelle) + BigInt(conservees || '0');

  // Premier chiffre écarté : il décide de l'arrondi. Les suivants ne changent rien,
  // la règle du plus proche ne regardant que le rang immédiatement inférieur.
  const premiereRejetee = decimales.charAt(echelle);
  if (premiereRejetee !== '' && premiereRejetee >= '5') {
    unites += 1n;
  }

  return negatif ? -unites : unites;
}

// La valeur perd-elle de la précision à cette échelle ? Permet à un appelant de
// refuser une entrée plutôt que de l'arrondir, là où l'arrondi ne serait pas légitime.
function excedeLEchelle(valeur, echelle) {
  const texte = versNotationPositionnelle(String(valeur).trim());
  const [, decimales = ''] = texte.split('.');
  return decimales.replace(/0+$/, '').length > echelle;
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

// Produit de deux valeurs d'échelles quelconques, rendu à l'échelle demandée.
//
// Le produit de deux entiers d'échelles sa et sb est un entier d'échelle sa + sb : c'est
// une propriété de la représentation, pas une convention. Il ne reste qu'à le ramener à
// l'échelle voulue.
function multiplier(a, echelleA, b, echelleB, echelleResultat) {
  return convertirEchelle(a * b, echelleA + echelleB, echelleResultat);
}

// Quotient de deux valeurs d'échelles quelconques, rendu à l'échelle demandée.
//
// Le numérateur est d'abord porté à l'échelle du résultat augmentée de celle du
// diviseur : la division entière rend alors directement l'échelle attendue, et toute la
// précision demandée est calculée avant l'unique arrondi.
function diviser(a, echelleA, b, echelleB, echelleResultat) {
  const numerateur = convertirEchelle(a, echelleA, echelleResultat + echelleB);
  return diviserEntiers(numerateur, b);
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
  ECHELLE_PRIX,
  ECHELLE_PRU,
  ECHELLE_TAUX,
  ECHELLE_MONTANT,
  ECHELLE_POURCENTAGE,
  versUnites,
  versChaine,
  versNotationPositionnelle,
  excedeLEchelle,
  formater,
  convertirEchelle,
  additionner,
  soustraire,
  multiplier,
  diviser,
  comparer,
  estZero,
};
