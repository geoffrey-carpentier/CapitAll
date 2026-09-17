// Formatage des valeurs numériques affichées (docs/conception/formatage-nombres.md).
// Aucun composant ne formate un nombre lui-même.
//
// Les valeurs arrivent du serveur en chaînes, stockées en NUMERIC, et restent des
// chaînes de bout en bout : aucune n'est convertie en flottant, même pour l'affichage.
// Seul l'exposant d'une notation scientifique est lu comme un entier.

// Espace fine insécable, séparateur de milliers en typographie française.
const ESPACE_MILLIERS = ' ';
// Espace insécable, entre la valeur et son symbole.
const ESPACE_SYMBOLE = ' ';
// Signe moins typographique (U+2212) : même chasse que les chiffres, les colonnes
// restent alignées.
const MOINS = '−';

// Les montants restent en euros dans les données : seul le symbole affiché change.
export const SYMBOLES_DEVISE = { EUR: '€', USD: '$' };

export function symboleDevise(devise) {
  return SYMBOLES_DEVISE[devise] ?? SYMBOLES_DEVISE.EUR;
}

// Précisions par classe d'actif. Les métaux sont en onces troy, unité de cotation du
// fournisseur et de saisie : aucune conversion en grammes n'est faite.
const FORMATS_QUANTITE = {
  crypto: { decimales: 8, unite: (symbole) => symbole },
  metal: { decimales: 4, unite: () => 'oz' },
  devise: { decimales: 2, unite: (symbole) => symbole },
  action: { decimales: 6, unite: (_, valeur) => (estSingulier(valeur) ? 'titre' : 'titres') },
};

// ---------------------------------------------------------------------------
// Manipulation de chaînes décimales
// ---------------------------------------------------------------------------

// Notation scientifique vers notation positionnelle. Nécessaire pour les graduations
// calculées par la bibliothèque de graphes : JavaScript écrit en exposant les nombres
// inférieurs à 1e-6.
export function versNotationPositionnelle(chaine) {
  const texte = String(chaine ?? '').trim();
  const correspondance = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(texte);

  if (!correspondance) {
    return texte;
  }

  const [, signe, entiere, decimale = '', exposant] = correspondance;
  const chiffres = `${entiere}${decimale}`;
  const virgule = entiere.length + Number(exposant);

  if (virgule <= 0) {
    return `${signe}0.${'0'.repeat(-virgule)}${chiffres}`;
  }
  if (virgule >= chiffres.length) {
    return `${signe}${chiffres}${'0'.repeat(virgule - chiffres.length)}`;
  }
  return `${signe}${chiffres.slice(0, virgule)}.${chiffres.slice(virgule)}`;
}

// Découpe une chaîne décimale en ses trois composants, sans jamais l'évaluer.
function decomposer(chaine) {
  const texte = versNotationPositionnelle(chaine);
  const negatif = texte.startsWith('-') || texte.startsWith(MOINS);
  const absolu = negatif ? texte.slice(1) : texte;
  const [entiere = '', decimale = ''] = absolu.split('.');

  return { negatif, entiere: entiere || '0', decimale };
}

// Chiffres, un signe et au plus un séparateur décimal : toute autre entrée est refusée
// plutôt que devinée.
function estDecimaleValide(chaine) {
  const texte = versNotationPositionnelle(chaine);
  return /^[-−]?\d*(\.\d*)?$/.test(texte) && /\d/.test(texte);
}

// En français, le pluriel commence à deux : « 1,5 titre », « 2 titres ».
function estSingulier(composants) {
  return !estSuperieureOuEgale(composants, '2');
}

function estNul({ entiere, decimale }) {
  return !/[1-9]/.test(entiere) && !/[1-9]/.test(decimale);
}

// Arrondi à n décimales sur la chaîne. Les demis s'éloignent de zéro, pour traiter
// gains et pertes de façon symétrique.
function arrondir({ negatif, entiere, decimale }, decimales) {
  const conservees = decimale.slice(0, decimales);
  const premiereRejetee = decimale.charAt(decimales);
  const arrondiVersLeHaut = premiereRejetee !== '' && premiereRejetee >= '5';

  let chiffres = (entiere + conservees.padEnd(decimales, '0')).replace(/^0+(?=\d)/, '');

  if (arrondiVersLeHaut) {
    chiffres = incrementer(chiffres);
  }

  const coupure = chiffres.length - decimales;
  const nouvelleEntiere = (coupure > 0 ? chiffres.slice(0, coupure) : '0').replace(/^0+(?=\d)/, '');
  const nouvelleDecimale = decimales > 0 ? chiffres.slice(-decimales).padStart(decimales, '0') : '';

  return { negatif, entiere: nouvelleEntiere || '0', decimale: nouvelleDecimale };
}

// Chiffre suivant par table, sans arithmétique sur la valeur.
const CHIFFRE_SUIVANT = { 0: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7', 7: '8', 8: '9' };

// Ajoute 1 à un entier représenté en chaîne, en propageant la retenue.
function incrementer(chiffres) {
  const resultat = chiffres.split('');
  let position = resultat.length - 1;

  while (position >= 0) {
    if (resultat[position] === '9') {
      resultat[position] = '0';
      position -= 1;
    } else {
      resultat[position] = CHIFFRE_SUIVANT[resultat[position]];
      return resultat.join('');
    }
  }

  return `1${resultat.join('')}`;
}

function grouperMilliers(entiere) {
  return entiere.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
}

// Les zéros de fin sont toujours supprimés, dans les six catégories.
function composer({ negatif, entiere, decimale }) {
  const decimaleUtile = decimale.replace(/0+$/, '');
  const corps = grouperMilliers(entiere) + (decimaleUtile ? `,${decimaleUtile}` : '');

  return (negatif ? MOINS : '') + corps;
}

// Rend null si l'entrée n'est pas exploitable : l'appelant décide quoi afficher.
function formaterDecimale(chaine, decimales) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }
  return composer(arrondir(decomposer(chaine), decimales));
}

// ---------------------------------------------------------------------------
// Catégorie 1 : montants en devise fiduciaire
// ---------------------------------------------------------------------------

const DECIMALES_MONTANT = 2;

export function formaterMontant(chaine, { symbole = '€' } = {}) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);
  const arrondi = arrondir(composants, DECIMALES_MONTANT);

  // Une valeur non nulle ne s'affiche jamais « 0 € », ce qui ferait croire à une
  // position vide : elle remonte au centime.
  if (estNul(arrondi) && !estNul(composants)) {
    return `${composants.negatif ? MOINS : ''}0,01${ESPACE_SYMBOLE}${symbole}`;
  }

  return `${composer(arrondi)}${ESPACE_SYMBOLE}${symbole}`;
}

// ---------------------------------------------------------------------------
// Catégorie 2 : quantités d'actifs
// ---------------------------------------------------------------------------

// Échelle de stockage des quantités.
const DECIMALES_QUANTITE_MAXIMALES = 18;

export function formaterQuantite(chaine, classeActif, symbole = '') {
  const format = FORMATS_QUANTITE[classeActif];

  if (!format || !estDecimaleValide(chaine)) {
    return null;
  }

  const arrondi = arrondir(decomposer(chaine), format.decimales);
  const unite = format.unite(symbole, arrondi);

  return unite ? `${composer(arrondi)}${ESPACE_SYMBOLE}${unite}` : composer(arrondi);
}

// Quantité dont on connaît l'unité mais pas la classe, comme des frais prélevés en
// nature. Sans classe, pas de précision à choisir : la valeur n'est pas arrondie en deçà
// de l'échelle de stockage, seuls les zéros de fin sont retirés.
export function formaterQuantiteEnNature(chaine, unite = '') {
  const formatee = formaterDecimale(chaine, DECIMALES_QUANTITE_MAXIMALES);

  if (formatee === null) {
    return null;
  }

  return unite ? `${formatee}${ESPACE_SYMBOLE}${unite}` : formatee;
}

// ---------------------------------------------------------------------------
// Catégorie 3 : cours unitaires
// ---------------------------------------------------------------------------

// Chiffres significatifs conservés sous l'unité.
const CHIFFRES_SIGNIFICATIFS = 4;

// Échelle de stockage des prix.
const DECIMALES_MAXIMALES = 18;

// La précision suit l'ordre de grandeur, lu sur la longueur de la partie entière et la
// position du premier chiffre significatif.
function decimalesSelonOrdreDeGrandeur({ entiere, decimale }) {
  const entiereUtile = entiere.replace(/^0+(?=\d)/, '');

  // À partir de 10 : deux décimales ; entre 1 et 10 : quatre.
  if (/[1-9]/.test(entiereUtile)) {
    return entiereUtile.length >= 2 ? 2 : 4;
  }

  // Sous l'unité, la précision se compte en chiffres significatifs, pour qu'un cours
  // très faible ne s'affiche jamais « 0 € ».
  const premierSignificatif = decimale.search(/[1-9]/);

  if (premierSignificatif === -1) {
    return DECIMALES_MAXIMALES;
  }

  return Math.min(premierSignificatif + CHIFFRES_SIGNIFICATIFS, DECIMALES_MAXIMALES);
}

export function formaterCours(chaine, { symbole = '€' } = {}) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);
  const decimales = decimalesSelonOrdreDeGrandeur(composants);
  const arrondi = arrondir(composants, decimales);

  // Garde pour une valeur plus fine que l'échelle de stockage : un cours existant ne
  // s'affiche jamais comme nul.
  if (estNul(arrondi) && !estNul(composants)) {
    const plancher = `0,${'0'.repeat(DECIMALES_MAXIMALES - 1)}1`;
    return `<${ESPACE_SYMBOLE}${plancher}${ESPACE_SYMBOLE}${symbole}`;
  }

  return `${composer(arrondi)}${ESPACE_SYMBOLE}${symbole}`;
}

// ---------------------------------------------------------------------------
// Catégorie 4 : taux de change
// ---------------------------------------------------------------------------

const DECIMALES_TAUX = 4;

export function formaterTaux(chaine) {
  return formaterDecimale(chaine, DECIMALES_TAUX);
}

// ---------------------------------------------------------------------------
// Catégorie 5 : pourcentages
// ---------------------------------------------------------------------------

const DECIMALES_POURCENTAGE = 1;

export function formaterPourcentage(chaine) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);
  const arrondi = arrondir(composants, DECIMALES_POURCENTAGE);

  // Une part qui existe ne s'affiche pas « 0 % ».
  if (estNul(arrondi) && !estNul(composants)) {
    return `<${ESPACE_SYMBOLE}0,1${ESPACE_SYMBOLE}%`;
  }

  return `${composer(arrondi)}${ESPACE_SYMBOLE}%`;
}

// ---------------------------------------------------------------------------
// Catégorie 6 : variations
// ---------------------------------------------------------------------------

// Seuils du traitement graduel, exprimés en points de pourcentage.
const AMPLITUDE_FORTE = '10';
const AMPLITUDE_MOYENNE = '1';

export function formaterVariation(chaine, mode = 'relative', options = {}) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);
  // Le symbole ne concerne que le mode absolu : un pourcentage ne change pas de devise.
  const formatee =
    mode === 'absolue'
      ? formaterMontant(chaine, options)
      : formaterPourcentage(chaine);

  if (formatee === null) {
    return null;
  }

  // Une variation nulle ne porte pas de signe : elle ne va nulle part.
  if (estNul(composants)) {
    return formatee;
  }

  // Signe obligatoire au positif : l'information ne doit pas reposer sur la seule
  // couleur. Le moins est déjà posé par composer().
  return composants.negatif ? formatee : `+${formatee}`;
}

// Compare deux valeurs absolues décomposées, sans conversion. Rend -1, 0 ou 1.
// La partie entière se compare par sa longueur puis chiffre à chiffre ; les parties
// décimales sont complétées de zéros à la même longueur.
function comparerAbsolus(a, b) {
  const entiereA = a.entiere.replace(/^0+(?=\d)/, '');
  const entiereB = b.entiere.replace(/^0+(?=\d)/, '');

  if (entiereA.length !== entiereB.length) {
    return entiereA.length > entiereB.length ? 1 : -1;
  }
  if (entiereA !== entiereB) {
    return entiereA > entiereB ? 1 : -1;
  }

  const longueur = Math.max(a.decimale.length, b.decimale.length);
  const decimaleA = a.decimale.padEnd(longueur, '0');
  const decimaleB = b.decimale.padEnd(longueur, '0');

  if (decimaleA === decimaleB) {
    return 0;
  }
  return decimaleA > decimaleB ? 1 : -1;
}

function estSuperieureOuEgale(composants, reference) {
  return comparerAbsolus(composants, decomposer(reference)) >= 0;
}

// Niveau de traitement visuel d'une variation, selon son amplitude en pourcentage.
// Rend 'forte', 'moyenne', 'faible' ou 'nulle'.
export function amplitudeVariation(chainePourcentage) {
  if (!estDecimaleValide(chainePourcentage)) {
    return null;
  }

  const composants = decomposer(chainePourcentage);

  if (estNul(composants)) {
    return 'nulle';
  }

  // Le signe ne joue pas sur l'amplitude : une baisse de 12 % pèse autant qu'une hausse.
  if (estSuperieureOuEgale(composants, AMPLITUDE_FORTE)) {
    return 'forte';
  }
  if (estSuperieureOuEgale(composants, AMPLITUDE_MOYENNE)) {
    return 'moyenne';
  }
  return 'faible';
}

// Sens d'une variation, pour choisir la flèche et la couleur.
export function sensVariation(chaine) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);

  if (estNul(composants)) {
    return 'stable';
  }
  return composants.negatif ? 'baisse' : 'hausse';
}

export const CLASSES_QUANTITE = Object.keys(FORMATS_QUANTITE);

// Comparateur exact de deux chaînes décimales, pour trier une liste.
//
// Le sens du tri est un paramètre plutôt qu'une inversion des arguments : une valeur
// absente (position sans cours) doit rester en dernier dans les deux sens.
export function comparerDecimales(a, b, { descendant = false } = {}) {
  const aValide = estDecimaleValide(a);
  const bValide = estDecimaleValide(b);

  if (!aValide || !bValide) {
    if (aValide) {
      return -1;
    }
    return bValide ? 1 : 0;
  }

  const composantsA = decomposer(a);
  const composantsB = decomposer(b);

  // Le zéro n'a pas de signe : « -0.00 » et « 0.00 » sont la même valeur.
  const signeA = estNul(composantsA) ? 0 : (composantsA.negatif ? -1 : 1);
  const signeB = estNul(composantsB) ? 0 : (composantsB.negatif ? -1 : 1);

  const sens = descendant ? -1 : 1;

  if (signeA !== signeB) {
    return (signeA < signeB ? -1 : 1) * sens;
  }
  if (signeA === 0) {
    return 0;
  }

  // À signe égal, l'ordre des valeurs absolues s'inverse chez les négatifs :
  // -12 est plus petit que -3.
  return comparerAbsolus(composantsA, composantsB) * signeA * sens;
}
