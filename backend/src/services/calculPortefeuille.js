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
// Les valeurs entrent et sortent en chaînes de caractères ; à l'intérieur, tout est
// entier (src/utils/decimal.js).

const {
  ECHELLE_QUANTITE,
  ECHELLE_MONTANT,
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

  const mouvements = trierChronologiquement(transactions).map((transaction) => {
    const quantiteTransaction = versUnites(transaction.quantite, ECHELLE_QUANTITE);
    // Prix et frais sont saisis à 2 décimales, remontés à 8 pour rester homogènes
    // avec le PRU pendant le calcul.
    const prixUnitaire = convertirEchelle(
      versUnites(transaction.prix_unitaire, ECHELLE_MONTANT),
      ECHELLE_MONTANT,
      ECHELLE_PRU
    );
    const frais = convertirEchelle(
      versUnites(transaction.frais ?? '0', ECHELLE_MONTANT),
      ECHELLE_MONTANT,
      ECHELLE_PRU
    );

    const pruAvant = pru;
    // Plus-value de cette vente-ci, à distinguer du cumul de la position. Elle reste
    // nulle sur un achat, qui n'en dégage aucune.
    let gainDeLOperation = null;

    if (transaction.sens === 'achat') {
      // Règles 1 et 2 : moyenne pondérée, frais d'achat inclus au coût de revient.
      const coutExistant = multiplier(pru, quantite, ECHELLE_PRU);
      const coutAchat = multiplier(prixUnitaire, quantiteTransaction, ECHELLE_PRU) + frais;
      const nouvelleQuantite = quantite + quantiteTransaction;

      // Un achat de quantité nulle est refusé à la validation ; la garde évite
      // malgré tout toute division par zéro sur une donnée inattendue.
      pru = nouvelleQuantite === 0n ? 0n : diviser(coutExistant + coutAchat, nouvelleQuantite, ECHELLE_PRU);
      quantite = nouvelleQuantite;
    } else {
      // Règles 3 et 4 : le PRU ne bouge pas, la plus-value réalisée est cumulée.
      const gainUnitaire = prixUnitaire - pru;
      gainDeLOperation = multiplier(gainUnitaire, quantiteTransaction, ECHELLE_PRU) - frais;
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
        multiplier(prixUnitaire, quantiteTransaction, ECHELLE_PRU),
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
    };
  });

  return {
    mouvements,
    position: {
      quantite_detenue: versChaine(quantite, ECHELLE_QUANTITE),
      pru: versChaine(pru, ECHELLE_PRU),
      // Ce que représente encore la position au prix de revient, frais compris.
      cout_total: formater(multiplier(pru, quantite, ECHELLE_PRU), ECHELLE_PRU, ECHELLE_MONTANT),
      plus_value_realisee: formater(plusValueRealisee, ECHELLE_PRU, ECHELLE_MONTANT),
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
  const cours = versUnites(coursEur, ECHELLE_PRU);

  const valeur = multiplier(cours, quantite, ECHELLE_PRU);
  const plusValueLatente = multiplier(cours - pru, quantite, ECHELLE_PRU);
  const coutTotal = multiplier(pru, quantite, ECHELLE_PRU);

  // Le pourcentage n'a de sens que si un coût existe : sur une position soldée ou
  // sur un actif reçu sans coût, il n'est pas défini.
  const pourcentage =
    coutTotal === 0n
      ? null
      : formater(diviser(plusValueLatente * 100n, coutTotal, ECHELLE_PRU), ECHELLE_PRU, ECHELLE_MONTANT);

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

  const valeurParType = new Map();

  for (const position of positionsValorisees) {
    realiseeTotale += versUnites(position.plus_value_realisee ?? '0', ECHELLE_MONTANT);

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
function pourcentageVariation(plusValue, cout) {
  if (cout === 0n) {
    return null;
  }

  return formater(
    diviser(plusValue * 100n, cout, ECHELLE_PRU),
    ECHELLE_PRU,
    ECHELLE_MONTANT
  );
}

// Répartition en pourcentages dont la somme fait exactement 100.
//
// Arrondir chaque part indépendamment produirait un total à 99,98 % ou 100,01 %,
// impossible à défendre sur un graphique de répartition. La dernière part reçoit
// donc le reliquat : c'est la méthode dite du plus grand reste, appliquée simplement.
function repartir(valeurParType, valeurTotale) {
  if (valeurTotale === 0n) {
    return [];
  }

  const parts = [...valeurParType.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1));
  const cent = versUnites('100', ECHELLE_MONTANT);

  let cumul = 0n;
  return parts.map(([type, valeur], index) => {
    const dernier = index === parts.length - 1;
    const pourcentage = dernier ? cent - cumul : diviser(valeur * 100n, valeurTotale, ECHELLE_MONTANT);
    cumul += pourcentage;

    return {
      type,
      valeur: formater(valeur, ECHELLE_MONTANT, ECHELLE_MONTANT),
      pourcentage: formater(pourcentage, ECHELLE_MONTANT, ECHELLE_MONTANT),
    };
  });
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

// Variation entre le premier et le dernier point d'une série.
function performanceSurPeriode(points, champ = 'valeur_totale_eur') {
  if (points.length < 2) {
    return null;
  }

  const depart = versUnites(points[0][champ], ECHELLE_MONTANT);
  const arrivee = versUnites(points[points.length - 1][champ], ECHELLE_MONTANT);

  return pourcentageVariation(arrivee - depart, depart);
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
