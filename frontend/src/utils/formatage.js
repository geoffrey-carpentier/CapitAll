// Formatage des valeurs numériques affichées, selon docs/conception/formatage-nombres.md.
// Ce module est la seule source de vérité : aucun composant ne formate un nombre par
// lui-même, ce qui rend la politique vérifiable par une simple recherche dans le code.
//
// Règle fondatrice : les valeurs arrivent de l'interface de programmation sous forme de
// chaînes, parce qu'elles sont stockées en NUMERIC. Elles sont manipulées comme telles
// de bout en bout. Ni Number ni parseFloat n'apparaissent ici, pas même pour choisir un
// format : convertir en virgule flottante, y compris pour un simple affichage, rouvrirait
// la porte aux erreurs de représentation que le projet écarte partout ailleurs.

// Espace fine insécable, séparateur de milliers en typographie française.
const ESPACE_MILLIERS = ' ';
// Espace insécable, entre la valeur et son symbole.
const ESPACE_SYMBOLE = ' ';
// Signe moins typographique (U+2212), et non le trait d'union : il a la même chasse que
// les chiffres, ce qui préserve l'alignement des colonnes.
const MOINS = '−';

// Symbole de la devise d'affichage. Les montants restent en euros dans les données :
// seule leur présentation change (D43). Cette table vit ici, avec le reste des règles
// d'écriture, pour qu'aucun composant ne redéfinisse un symbole de son côté.
export const SYMBOLES_DEVISE = { EUR: '€', USD: '$' };

export function symboleDevise(devise) {
  return SYMBOLES_DEVISE[devise] ?? SYMBOLES_DEVISE.EUR;
}

// Précisions par classe d'actif (catégorie 2 de la politique).
const FORMATS_QUANTITE = {
  crypto: { decimales: 8, unite: (symbole) => symbole },
  metal: { decimales: 3, unite: () => 'g' },
  devise: { decimales: 2, unite: (symbole) => symbole },
  action: { decimales: 6, unite: (_, valeur) => (estSingulier(valeur) ? 'titre' : 'titres') },
};

// ---------------------------------------------------------------------------
// Manipulation de chaînes décimales
// ---------------------------------------------------------------------------

// Découpe une chaîne décimale en ses trois composants, sans jamais l'évaluer.
function decomposer(chaine) {
  const texte = String(chaine ?? '').trim();
  const negatif = texte.startsWith('-') || texte.startsWith(MOINS);
  const absolu = negatif ? texte.slice(1) : texte;
  const [entiere = '', decimale = ''] = absolu.split('.');

  return { negatif, entiere: entiere || '0', decimale };
}

// Une chaîne est exploitable si elle ne contient que des chiffres, un signe et au plus
// un séparateur décimal. Toute autre entrée est refusée plutôt que devinée.
function estDecimaleValide(chaine) {
  return /^[-−]?\d*(\.\d*)?$/.test(String(chaine ?? '').trim()) && /\d/.test(String(chaine ?? ''));
}

// En français, le pluriel commence à deux : on écrit « 0,5 titre » et « 1,5 titre »,
// mais « 2 titres ». La règle porte sur la valeur, pas sur la présence de décimales.
function estSingulier(composants) {
  return !estSuperieureOuEgale(composants, '2');
}

// La valeur est-elle exactement zéro ? Se lit sur les chiffres, sans conversion.
function estNul({ entiere, decimale }) {
  return !/[1-9]/.test(entiere) && !/[1-9]/.test(decimale);
}

// Arrondi au plus proche, à n décimales, entièrement en manipulation de chaînes.
// Les demis s'éloignent de zéro, règle usuelle en comptabilité qui traite gains et
// pertes de façon symétrique.
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

// Chiffre suivant, par simple table : aucune arithmétique, donc aucune conversion.
// Une recherche de « Number » ou « parseFloat » dans ce fichier ne doit rien remonter,
// c'est ce qui rend la politique vérifiable d'un coup d'œil.
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

// Insère le séparateur de milliers par groupes de trois, en partant de la droite.
function grouperMilliers(entiere) {
  return entiere.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
}

// Assemble les composants en chaîne affichable : zéros de fin toujours supprimés
// (convention commune aux six catégories).
function composer({ negatif, entiere, decimale }) {
  const decimaleUtile = decimale.replace(/0+$/, '');
  const corps = grouperMilliers(entiere) + (decimaleUtile ? `,${decimaleUtile}` : '');

  return (negatif ? MOINS : '') + corps;
}

// Formate une chaîne décimale à n décimales maximum. Rend null si l'entrée n'est pas
// exploitable, à charge pour l'appelant de décider quoi afficher.
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

  // Une valeur non nulle qui s'arrondit à zéro ne s'affiche jamais « 0 € » : cela
  // laisserait croire à une position vide. On remonte au centime, plus petite unité
  // qui ait un sens pour un patrimoine.
  if (estNul(arrondi) && !estNul(composants)) {
    return `${composants.negatif ? MOINS : ''}0,01${ESPACE_SYMBOLE}${symbole}`;
  }

  return `${composer(arrondi)}${ESPACE_SYMBOLE}${symbole}`;
}

// ---------------------------------------------------------------------------
// Catégorie 2 : quantités d'actifs
// ---------------------------------------------------------------------------

export function formaterQuantite(chaine, classeActif, symbole = '') {
  const format = FORMATS_QUANTITE[classeActif];

  if (!format || !estDecimaleValide(chaine)) {
    return null;
  }

  const arrondi = arrondir(decomposer(chaine), format.decimales);
  const unite = format.unite(symbole, arrondi);

  return unite ? `${composer(arrondi)}${ESPACE_SYMBOLE}${unite}` : composer(arrondi);
}

// ---------------------------------------------------------------------------
// Catégorie 3 : cours unitaires
// ---------------------------------------------------------------------------

// La précision suit l'ordre de grandeur. Celui-ci se lit sur la longueur de la partie
// entière et sur la position du premier chiffre significatif : aucune conversion n'est
// nécessaire pour le déterminer.
function decimalesSelonOrdreDeGrandeur({ entiere, decimale }) {
  const entiereUtile = entiere.replace(/^0+(?=\d)/, '');

  // Au moins une unité : deux décimales suffisent, l'information est dans la partie
  // entière (règles « ≥ 1 000 » et « ≥ 10 et < 1 000 » de la politique).
  if (/[1-9]/.test(entiereUtile)) {
    return entiereUtile.length >= 2 ? 2 : 4;
  }

  // Sous l'unité : la valeur est ≥ 0,01 si l'un des deux premiers chiffres décimaux
  // est significatif, sinon elle est inférieure et demande six décimales.
  return /[1-9]/.test(decimale.slice(0, 2)) ? 4 : 6;
}

export function formaterCours(chaine, { symbole = '€' } = {}) {
  if (!estDecimaleValide(chaine)) {
    return null;
  }

  const composants = decomposer(chaine);
  const decimales = decimalesSelonOrdreDeGrandeur(composants);

  return `${composer(arrondir(composants, decimales))}${ESPACE_SYMBOLE}${symbole}`;
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

  // Même raison qu'au centime : une part qui existe ne s'affiche pas « 0 % ».
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

  // Le signe est obligatoire, y compris au positif : il double l'information portée
  // par la couleur, condition d'accessibilité. Le moins est déjà posé par composer().
  return composants.negatif ? formatee : `+${formatee}`;
}

// Compare deux valeurs décimales en valeur absolue, sans jamais les convertir : d'abord
// la longueur de la partie entière, qui donne l'ordre de grandeur, puis l'ordre
// lexicographique une fois les parties alignées sur la même longueur.
// Compare deux valeurs absolues décomposées. Rend -1, 0 ou 1.
//
// La comparaison est lexicographique, jamais numérique : la partie entière se compare
// d'abord par sa longueur, ce qui départage les ordres de grandeur, puis chiffre à
// chiffre ; la partie décimale est complétée de zéros pour que les deux chaînes aient la
// même longueur avant d'être comparées. Aucune conversion n'intervient, la précision est
// donc celle des chaînes reçues, quelle qu'elle soit.
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

// Comparateur de deux valeurs décimales transmises en chaînes, pour trier une liste.
//
// Trier, c'est de la présentation : cela n'ajoute aucune information et ne crée aucun
// fait que le domaine devrait connaître. Mais comparer reste une opération sur des
// montants, et la faire en convertissant en nombres ferait rentrer par la fenêtre le
// flottant que toute cette politique met dehors. La comparaison se fait donc sur les
// chaînes, avec la même exactitude que le reste du module.
//
// Le sens du tri est un paramètre et ne s'obtient pas en inversant les arguments : une
// valeur absente doit se ranger en dernier dans les deux sens, et l'inversion des
// arguments la ferait remonter en tête au tri décroissant. Une position dont le cours
// n'a pas pu être obtenu n'a pas de rang ; la voir en tête laisserait croire à une
// valorisation extrême.
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
