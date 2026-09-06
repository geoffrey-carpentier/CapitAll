// Moteur de calcul du portefeuille : prix de revient unitaire moyen pondéré (PRU),
// plus-value réalisée, plus-value latente et consolidation.
//
// Toutes les fonctions de ce module sont pures : elles reçoivent des transactions et
// un cours, elles rendent un résultat. Aucune base, aucun appel réseau, aucun cache.
// C'est ce qui permet de les tester seules et de dérouler un calcul au tableau.
//
// Les six règles appliquées sont celles actées en D54 :
//   1. le PRU intègre les frais d'achat, il représente le coût de revient réel ;
//   2. un achat recalcule le PRU en moyenne pondérée ;
//   3. une vente ne modifie pas le PRU, seulement la quantité détenue ;
//   4. la plus-value réalisée d'une vente vaut
//      quantité × (prix de vente − PRU) − frais de vente, cumulée sur l'actif ;
//   5. une vente totale suivie d'un rachat repart d'un PRU neuf ;
//   6. les transactions sont traitées par ordre chronologique, l'identifiant
//      départageant les transactions de même date.
//
// D89 y ajoute une septième règle, qui ne touche à aucune des six : une sortie non
// marchande retire de la quantité sans produit en euros. Le prix de revient unitaire
// n'en est pas modifié, et la valeur qui quitte la position est portée par un résultat
// distinct de la plus-value réalisée.
//
// Les valeurs entrent et sortent en chaînes de caractères ; à l'intérieur, tout est
// entier (src/utils/decimal.js).

const {
  ECHELLE_QUANTITE,
  ECHELLE_PRIX,
  ECHELLE_MONTANT,
  ECHELLE_POURCENTAGE,
  ECHELLE_PRU,
  versUnites,
  versChaine,
  formater,
  convertirEchelle,
  multiplier,
  diviser,
} = require('../utils/decimal');

// Règle 6. Le tri est fait ici et non laissé au SQL : saisir après coup une
// transaction ancienne doit donner le même résultat que l'avoir saisie dans l'ordre.
// Le calcul ne doit pas dépendre de l'ordre de frappe.
function trierChronologiquement(transactions) {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.date_transaction).getTime();
    const dateB = new Date(b.date_transaction).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}

// Déroulé complet d'une position : l'état après chaque mouvement, et l'état final.
//
// Une seule traversée produit les deux, et c'est délibéré. Le prix de revient après un
// achat donné ne se retrouve pas en rejouant un calcul séparé : il faut avoir rejoué
// toute l'histoire de la position dans le même ordre, avec les mêmes arrondis. Deux
// implémentations parallèles finiraient par diverger sur un cas de bord, et c'est
// précisément ce chiffre qu'il faut pouvoir défendre au tableau.
//
// L'effet de chaque mouvement sur le prix de revient est donc un fait calculé ici, du
// côté qui détient le moteur, et non une reconstitution faite par l'interface (D69).
function derouler(transactions) {
  // Quantité et PRU sont tenus à l'échelle des quantités et du PRU, soit 8 décimales.
  let quantite = 0n;
  let pru = 0n;
  let plusValueRealisee = 0n;
  // Valeur sortie du patrimoine sans contrepartie : retraits, transferts, frais réglés
  // en nature. Elle est cumulée à part de la plus-value réalisée, qui se constate lors
  // d'une vente et n'a rien à dire d'un mouvement qui n'en est pas une.
  let coutSorties = 0n;

  const mouvements = trierChronologiquement(transactions).map((transaction) => {
    const quantiteTransaction = versUnites(transaction.quantite, ECHELLE_QUANTITE);
    // Le prix garde son échelle propre : le ramener à celle des montants, comme le
    // faisait la version précédente, effaçait tout ce qui se joue sous le centime.
    // Une sortie non marchande n'en porte pas : la colonne vaut zéro, la contrainte de
    // schéma l'impose, et le mouvement rend donc un montant nul.
    const prixUnitaire = versUnites(transaction.prix_unitaire ?? '0', ECHELLE_PRIX);
    // Les frais sont un montant en euros, réglé au centime. Ils sont portés à l'échelle
    // du prix de revient parce qu'ils s'ajoutent à un coût qui s'y tient ; la conversion
    // ne fait qu'ajouter des zéros, elle n'arrondit rien.
    const frais = convertirEchelle(
      versUnites(transaction.frais ?? '0', ECHELLE_MONTANT),
      ECHELLE_MONTANT,
      ECHELLE_PRU
    );

    const pruAvant = pru;
    // Plus-value de cette vente-ci, à distinguer du cumul de la position. Elle reste
    // nulle sur un achat, qui n'en dégage aucune, et sur une sortie, qui n'est pas une
    // vente : dans les deux cas le mouvement rend null et non zéro, faute de quoi la
    // frise afficherait « 0,00 € » là où la notion ne s'applique pas.
    let gainDeLOperation = null;
    // Valeur emportée par ce mouvement-ci, au prix de revient. Même distinction.
    let coutDeLaSortie = null;

    if (transaction.sens === 'achat') {
      // Règles 1 et 2 : moyenne pondérée, frais d'achat inclus au coût de revient.
      const coutExistant = multiplier(pru, ECHELLE_PRU, quantite, ECHELLE_QUANTITE, ECHELLE_PRU);
      const coutAchat =
        multiplier(prixUnitaire, ECHELLE_PRIX, quantiteTransaction, ECHELLE_QUANTITE, ECHELLE_PRU) +
        frais;
      const nouvelleQuantite = quantite + quantiteTransaction;

      // Un achat de quantité nulle est refusé à la validation ; la garde évite
      // malgré tout toute division par zéro sur une donnée inattendue.
      pru =
        nouvelleQuantite === 0n
          ? 0n
          : diviser(
              coutExistant + coutAchat,
              ECHELLE_PRU,
              nouvelleQuantite,
              ECHELLE_QUANTITE,
              ECHELLE_PRU
            );
      quantite = nouvelleQuantite;
    } else if (transaction.sens === 'sortie_non_marchande') {
      // Règle 7. La quantité sort, le prix de revient unitaire ne bouge pas.
      //
      // Le coût restant de la position vaut PRU × quantité : décrémenter la quantité
      // le réduit donc exactement au prorata, sans qu'aucune écriture ne s'y ajoute.
      // C'est le point à ne pas manquer — réduire un coût conservé à part sans toucher
      // à la quantité, ou l'inverse, ferait mécaniquement dériver le PRU unitaire d'un
      // mouvement qui, par définition, ne l'affecte pas.
      coutDeLaSortie =
        multiplier(pru, ECHELLE_PRU, quantiteTransaction, ECHELLE_QUANTITE, ECHELLE_PRU) + frais;
      coutSorties += coutDeLaSortie;
      quantite -= quantiteTransaction;

      // Règle 5, applicable telle quelle : une position vidée repart d'un PRU neuf.
      if (quantite <= 0n) {
        quantite = 0n;
        pru = 0n;
      }
    } else {
      // Règles 3 et 4 : le PRU ne bouge pas, la plus-value réalisée est cumulée.
      // Le prix est porté à l'échelle du PRU avant la soustraction : deux valeurs
      // d'échelles différentes ne se retranchent pas.
      const gainUnitaire = convertirEchelle(prixUnitaire, ECHELLE_PRIX, ECHELLE_PRU) - pru;
      gainDeLOperation =
        multiplier(gainUnitaire, ECHELLE_PRU, quantiteTransaction, ECHELLE_QUANTITE, ECHELLE_PRU) -
        frais;
      plusValueRealisee += gainDeLOperation;
      quantite -= quantiteTransaction;

      // Règle 5 : position soldée, le PRU repart de zéro pour un éventuel rachat.
      if (quantite <= 0n) {
        quantite = 0n;
        pru = 0n;
      }
    }

    return {
      ...transaction,
      // Montant brut de l'opération, frais exclus : ils sont déjà rendus à part et les
      // additionner ici les compterait deux fois à l'écran.
      montant: formater(
        multiplier(prixUnitaire, ECHELLE_PRIX, quantiteTransaction, ECHELLE_QUANTITE, ECHELLE_PRU),
        ECHELLE_PRU,
        ECHELLE_MONTANT
      ),
      pru_avant: versChaine(pruAvant, ECHELLE_PRU),
      pru_apres: versChaine(pru, ECHELLE_PRU),
      // Zéro sur une vente ordinaire, la règle 3 laissant le prix de revient intact ;
      // franchement négatif sur une vente qui solde la position, où la règle 5 le
      // remet à zéro. Les deux cas se lisent sur ce seul chiffre.
      effet_pru: versChaine(pru - pruAvant, ECHELLE_PRU),
      quantite_apres: versChaine(quantite, ECHELLE_QUANTITE),
      plus_value_realisee:
        gainDeLOperation === null
          ? null
          : formater(gainDeLOperation, ECHELLE_PRU, ECHELLE_MONTANT),
      // Valeur emportée par une sortie non marchande, au prix de revient. Nulle
      // ailleurs : c'est le champ qui distingue un transfert d'une vente, et il ne
      // doit jamais se confondre avec la ligne précédente.
      cout_sortie:
        coutDeLaSortie === null ? null : formater(coutDeLaSortie, ECHELLE_PRU, ECHELLE_MONTANT),
    };
  });

  return {
    mouvements,
    position: {
      quantite_detenue: versChaine(quantite, ECHELLE_QUANTITE),
      pru: versChaine(pru, ECHELLE_PRU),
      // Ce que représente encore la position au prix de revient, frais compris.
      cout_total: formater(
        multiplier(pru, ECHELLE_PRU, quantite, ECHELLE_QUANTITE, ECHELLE_PRU),
        ECHELLE_PRU,
        ECHELLE_MONTANT
      ),
      plus_value_realisee: formater(plusValueRealisee, ECHELLE_PRU, ECHELLE_MONTANT),
      // Cumul des sorties non marchandes de la position, au prix de revient. Ce n'est
      // ni un gain ni une perte de marché : c'est du coût qui a quitté le portefeuille
      // sans être vendu, et le confondre avec une plus-value réalisée reviendrait à
      // présenter un virement comme une opération de bourse.
      cout_frais_eur: formater(coutSorties, ECHELLE_PRU, ECHELLE_MONTANT),
    },
  };
}

function calculerPosition(transactions) {
  return derouler(transactions).position;
}

// Valorisation d'une position à un cours donné. Un cours absent ne vaut pas zéro :
// la position est alors rendue sans valorisation, à charge pour le front de signaler
// que le cours est momentanément indisponible.
function valoriser(position, coursEur) {
  if (coursEur === null || coursEur === undefined || coursEur === '') {
    return { ...position, valeur: null, plus_value_latente: null, pourcentage_variation: null };
  }

  const quantite = versUnites(position.quantite_detenue, ECHELLE_QUANTITE);
  const pru = versUnites(position.pru, ECHELLE_PRU);
  const cours = versUnites(coursEur, ECHELLE_PRIX);

  const valeur = multiplier(cours, ECHELLE_PRIX, quantite, ECHELLE_QUANTITE, ECHELLE_PRU);
  const plusValueLatente = multiplier(
    convertirEchelle(cours, ECHELLE_PRIX, ECHELLE_PRU) - pru,
    ECHELLE_PRU,
    quantite,
    ECHELLE_QUANTITE,
    ECHELLE_PRU
  );
  const coutTotal = multiplier(pru, ECHELLE_PRU, quantite, ECHELLE_QUANTITE, ECHELLE_PRU);

  // Le pourcentage n'a de sens que si un coût existe : sur une position soldée ou
  // sur un actif reçu sans coût, il n'est pas défini.
  const pourcentage =
    coutTotal === 0n ? null : pourcentageVariation(plusValueLatente, coutTotal, ECHELLE_PRU);

  return {
    ...position,
    valeur: formater(valeur, ECHELLE_PRU, ECHELLE_MONTANT),
    plus_value_latente: formater(plusValueLatente, ECHELLE_PRU, ECHELLE_MONTANT),
    pourcentage_variation: pourcentage,
  };
}

// Consolidation de l'ensemble des positions valorisées.
function consolider(positionsValorisees) {
  let valeurTotale = 0n;
  let coutTotal = 0n;
  let latenteTotale = 0n;
  let realiseeTotale = 0n;
  let coutSortiesTotal = 0n;

  const valeurParType = new Map();

  for (const position of positionsValorisees) {
    realiseeTotale += versUnites(position.plus_value_realisee ?? '0', ECHELLE_MONTANT);
    // Comme la plus-value réalisée, le coût des sorties est un fait passé : il se
    // cumule avant le filtre sur le cours, qui ne concerne que la valorisation du jour.
    coutSortiesTotal += versUnites(position.cout_frais_eur ?? '0', ECHELLE_MONTANT);

    // Une position sans cours n'entre ni dans la valeur totale ni dans la
    // répartition : l'y compter pour zéro fausserait les deux.
    if (position.valeur === null || position.valeur === undefined) {
      continue;
    }

    const valeur = versUnites(position.valeur, ECHELLE_MONTANT);
    valeurTotale += valeur;
    coutTotal += versUnites(position.cout_total ?? '0', ECHELLE_MONTANT);
    latenteTotale += versUnites(position.plus_value_latente ?? '0', ECHELLE_MONTANT);

    valeurParType.set(position.type, (valeurParType.get(position.type) ?? 0n) + valeur);
  }

  return {
    valeur_totale: formater(valeurTotale, ECHELLE_MONTANT, ECHELLE_MONTANT),
    cout_total: formater(coutTotal, ECHELLE_MONTANT, ECHELLE_MONTANT),
    plus_value_latente: formater(latenteTotale, ECHELLE_MONTANT, ECHELLE_MONTANT),
    plus_value_realisee: formater(realiseeTotale, ECHELLE_MONTANT, ECHELLE_MONTANT),
    cout_frais_eur: formater(coutSortiesTotal, ECHELLE_MONTANT, ECHELLE_MONTANT),
    // Même mécanique que le pourcentage d'une position, appliquée aux totaux : c'est la
    // variation du patrimoine depuis l'origine, que l'interface affiche à côté du
    // montant dominant. La calculer ici plutôt que côté front évite d'avoir deux
    // arithmétiques de montants dans le dépôt.
    pourcentage_variation: pourcentageVariation(latenteTotale, coutTotal),
    repartition: repartir(valeurParType, valeurTotale),
  };
}

// Variation relative d'un ensemble, en pourcentage.
//
// Un coût nul ne rend pas un pourcentage infini : il rend l'absence de pourcentage.
// Le cas se produit sur un portefeuille vide, et sur un portefeuille dont aucune
// position n'a de coût, deux situations où « + ∞ % » n'aurait aucun sens.
// L'échelle des deux opérandes est un paramètre : la même mécanique sert des montants
// au centime, venus de la consolidation, et des valeurs au prix de revient, venues de la
// valorisation d'une position. Multiplier par cent ne change pas l'échelle, seul le
// quotient la porte.
function pourcentageVariation(plusValue, cout, echelle = ECHELLE_MONTANT) {
  if (cout === 0n) {
    return null;
  }

  return formater(
    diviser(plusValue * 100n, echelle, cout, echelle, ECHELLE_POURCENTAGE),
    ECHELLE_POURCENTAGE,
    ECHELLE_MONTANT
  );
}

// Répartition en pourcentages dont la somme fait exactement 100.
//
// Arrondir chaque part indépendamment produirait un total à 99,98 % ou 100,01 %,
// impossible à défendre sur un graphique de répartition. Il faut donc répartir un
// reliquat, et la façon de le faire n'est pas neutre.
//
// La version précédente donnait tout le reliquat à la dernière part. Sur quatre valeurs
// positives de 16 668, 16 668, 16 663 et 1 euro, les trois premières arrondissent chacune
// vers le haut et la quatrième reçoit ce qu'il reste : −0,01 %. Une catégorie qui vaut un
// euro ne peut pas peser une part négative, et le commentaire annonçait par ailleurs la
// méthode du plus grand reste, qui n'était pas celle appliquée.
//
// Méthode réellement employée ici. Chaque part reçoit d'abord sa valeur exacte tronquée,
// jamais arrondie : la somme des troncatures est donc inférieure ou égale à 100, et le
// déficit vaut au plus le nombre de catégories moins une. Ce déficit est ensuite
// distribué, un centième de point à la fois, aux catégories dont le reste de division est
// le plus grand. Aucune part ne peut ainsi devenir négative, et la somme vaut exactement
// 100.
//
// Les égalités sont départagées par le nom de la catégorie. C'est arbitraire, mais c'est
// stable : deux portefeuilles identiques rendent la même répartition, ce que l'ancien
// comparateur ne garantissait pas.
function repartir(valeurParType, valeurTotale) {
  if (valeurTotale === 0n) {
    return [];
  }

  const cent = versUnites('100', ECHELLE_MONTANT);

  // Part exacte tronquée, et reste de la division, conservé pour arbitrer la suite.
  const parts = [...valeurParType.entries()].map(([type, valeur]) => ({
    type,
    valeur,
    pourcentage: (valeur * cent) / valeurTotale,
    reste: (valeur * cent) % valeurTotale,
  }));

  let deficit = cent - parts.reduce((total, part) => total + part.pourcentage, 0n);

  // Les plus grands restes servis en premier ; à reste égal, le nom départage.
  const ordreDesRestes = [...parts].sort((a, b) => {
    if (a.reste !== b.reste) {
      return b.reste > a.reste ? 1 : -1;
    }
    return a.type < b.type ? -1 : 1;
  });

  for (const part of ordreDesRestes) {
    if (deficit <= 0n) {
      break;
    }
    part.pourcentage += 1n;
    deficit -= 1n;
  }

  // Présentation par poids décroissant, le nom départageant les valeurs égales.
  parts.sort((a, b) => {
    if (a.valeur !== b.valeur) {
      return b.valeur > a.valeur ? 1 : -1;
    }
    return a.type < b.type ? -1 : 1;
  });

  return parts.map(({ type, valeur, pourcentage }) => ({
    type,
    valeur: formater(valeur, ECHELLE_MONTANT, ECHELLE_MONTANT),
    pourcentage: formater(pourcentage, ECHELLE_MONTANT, ECHELLE_MONTANT),
  }));
}

// Performance du portefeuille sur chacune des plages du sélecteur de période.
//
// Les plages sont calculées en une fois : l'interface les affiche toutes sans clic,
// et cinq requêtes pour cinq chiffres serait absurde.
//
// La borne haute est la date du dernier instantané, jamais l'horloge du serveur. Deux
// raisons : la fonction reste pure et testable sans figer le temps, et la performance
// d'une plage se lit entre deux mesures réelles, pas entre une mesure et une date à
// laquelle rien n'a été relevé.
//
// Le nom de la colonne mesurée est un paramètre : la même mécanique sert la valeur
// totale du portefeuille et le cours d'une position, deux séries de même forme dont
// seule l'étiquette diffère. En écrire une seconde copie garantirait qu'un jour les
// deux sélecteurs de période ne comptent plus les jours de la même façon.
const PLAGES_EN_JOURS = { jour: 1, semaine: 7, mois: 30, annee: 365 };

function calculerPerformances(instantanes, champ = 'valeur_totale_eur') {
  const plages = Object.keys(PLAGES_EN_JOURS);

  // Un point isolé ne dit rien d'une évolution : aucune plage n'est calculable.
  if (instantanes.length < 2) {
    return Object.fromEntries([...plages, 'origine'].map((plage) => [plage, null]));
  }

  const derniereDate = instantanes[instantanes.length - 1].date_snapshot;

  const performances = plages.map((plage) => {
    const debut = reculerDe(derniereDate, PLAGES_EN_JOURS[plage]);
    // Les dates sont au format AAAA-MM-JJ : leur ordre lexicographique est leur ordre
    // chronologique, aucune conversion n'est nécessaire pour filtrer.
    return [
      plage,
      performanceSurPeriode(
        instantanes.filter((point) => point.date_snapshot >= debut),
        champ
      ),
    ];
  });

  return {
    ...Object.fromEntries(performances),
    origine: performanceSurPeriode(instantanes, champ),
  };
}

// Échelle de lecture d'une série, selon ce qu'elle mesure.
//
// Les deux séries ont la même forme mais pas la même nature : l'une porte la valeur d'un
// patrimoine, réglée au centime, l'autre le cours d'un actif, qui descend bien plus bas.
// Les lire toutes deux à l'échelle des montants ramenait à zéro tout cours inférieur au
// centime : la performance d'un jeton dont le cours doublait était rendue « indisponible »
// faute de deux points distincts, alors qu'elle valait cent pour cent.
const ECHELLE_PAR_CHAMP = {
  valeur_totale_eur: ECHELLE_MONTANT,
  cours_eur: ECHELLE_PRIX,
};

// Variation entre le premier et le dernier point d'une série.
function performanceSurPeriode(points, champ = 'valeur_totale_eur') {
  if (points.length < 2) {
    return null;
  }

  const echelle = ECHELLE_PAR_CHAMP[champ] ?? ECHELLE_MONTANT;
  const depart = versUnites(points[0][champ], echelle);
  const arrivee = versUnites(points[points.length - 1][champ], echelle);

  return pourcentageVariation(arrivee - depart, depart, echelle);
}

// Date reculée d'un nombre de jours, en UTC et par composants.
//
// Passer par Date.UTC plutôt que par l'analyse d'une chaîne évite le décalage d'un jour
// qu'introduit l'interprétation d'une date seule dans le fuseau local, décalage déjà
// rencontré sur ces mêmes instantanés.
function reculerDe(dateIso, jours) {
  const [annee, mois, jour] = dateIso.split('-');
  const instant = Date.UTC(Number(annee), Number(mois) - 1, Number(jour) - jours);
  return new Date(instant).toISOString().slice(0, 10);
}

module.exports = {
  derouler,
  calculerPosition,
  valoriser,
  consolider,
  calculerPerformances,
  performanceSurPeriode,
  trierChronologiquement,
};
