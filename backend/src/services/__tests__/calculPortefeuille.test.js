import { describe, it, expect } from 'vitest';
import {
  derouler,
  calculerPosition,
  valoriser,
  consolider,
  calculerPerformances,
} from '../calculPortefeuille.js';

function achat(quantite, prix, frais = '0', date = '2026-01-01', id = 1) {
  return { id, sens: 'achat', quantite, prix_unitaire: prix, frais, date_transaction: date };
}

function vente(quantite, prix, frais = '0', date = '2026-01-01', id = 1) {
  return { id, sens: 'vente', quantite, prix_unitaire: prix, frais, date_transaction: date };
}

describe('calcul de position', () => {
  it('rend une position vide sans transaction', () => {
    const position = calculerPosition([]);
    expect(position.quantite_detenue).toBe('0');
    expect(position.pru).toBe('0');
    expect(position.plus_value_realisee).toBe('0.00');
  });

  // Règle 1 : les frais entrent dans le coût de revient. 10 titres à 100 euros plus
  // 5 euros de frais coûtent 1005 euros, soit un PRU de 100,50 et non de 100.
  it("intègre les frais d'achat au prix de revient", () => {
    const position = calculerPosition([achat('10', '100.00', '5.00')]);
    expect(position.pru).toBe('100.5');
    expect(position.cout_total).toBe('1005.00');
  });

  it('rend un PRU égal au prix quand les frais sont nuls', () => {
    const position = calculerPosition([achat('10', '100.00')]);
    expect(position.pru).toBe('100');
  });

  // Règle 2, cas vérifiable de tête : (1005 + 1205) / 20 = 110,50.
  it('recalcule le PRU en moyenne pondérée à chaque achat', () => {
    const position = calculerPosition([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
    ]);
    expect(position.quantite_detenue).toBe('20');
    expect(position.pru).toBe('110.5');
    expect(position.cout_total).toBe('2210.00');
  });

  // Règles 3 et 4 : la vente laisse le PRU intact et dégage
  // 5 × (150 − 110,50) − 5 = 192,50.
  it('ne modifie pas le PRU lors d\'une vente et cumule la plus-value réalisée', () => {
    const position = calculerPosition([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
      vente('5', '150.00', '5.00', '2026-03-10', 3),
    ]);
    expect(position.quantite_detenue).toBe('15');
    expect(position.pru).toBe('110.5');
    expect(position.plus_value_realisee).toBe('192.50');
  });

  it('calcule une plus-value réalisée négative sur une vente à perte', () => {
    const position = calculerPosition([
      achat('10', '100.00', '0', '2026-01-10', 1),
      vente('5', '80.00', '0', '2026-02-10', 2),
    ]);
    expect(position.plus_value_realisee).toBe('-100.00');
  });

  // Règle 5 : après une vente totale, un rachat repart d'un PRU neuf.
  it('remet le PRU à zéro après une vente totale, le rachat repartant de zéro', () => {
    const position = calculerPosition([
      achat('10', '100.00', '0', '2026-01-10', 1),
      vente('10', '150.00', '0', '2026-02-10', 2),
      achat('4', '200.00', '0', '2026-03-10', 3),
    ]);
    expect(position.quantite_detenue).toBe('4');
    expect(position.pru).toBe('200');
    expect(position.plus_value_realisee).toBe('500.00');
  });

  // Règle 6, garde-fou principal : saisir une transaction ancienne après coup doit
  // donner le même résultat que l'avoir saisie dans l'ordre.
  it('donne le même résultat quel que soit l\'ordre de saisie', () => {
    const chronologique = [
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
      vente('5', '150.00', '5.00', '2026-03-10', 3),
    ];
    const desordre = [chronologique[2], chronologique[0], chronologique[1]];

    expect(calculerPosition(desordre)).toEqual(calculerPosition(chronologique));
  });

  it('départage deux transactions de même date par leur identifiant', () => {
    const ordre = [
      achat('10', '100.00', '0', '2026-01-10', 1),
      vente('10', '150.00', '0', '2026-01-10', 2),
    ];
    const inverse = [ordre[1], ordre[0]];

    expect(calculerPosition(inverse)).toEqual(calculerPosition(ordre));
    expect(calculerPosition(inverse).plus_value_realisee).toBe('500.00');
  });

  // L'arithmétique entière doit rester exacte là où le flottant dérive.
  it('reste exact sur des quantités à 8 décimales', () => {
    const position = calculerPosition([
      achat('0.1', '100.00', '0', '2026-01-10', 1),
      achat('0.2', '100.00', '0', '2026-02-10', 2),
    ]);
    expect(position.quantite_detenue).toBe('0.3');
    expect(position.pru).toBe('100');
  });

  it('gère une quantité minimale de 0,00000001', () => {
    const position = calculerPosition([achat('0.00000001', '50000.00', '0')]);
    expect(position.quantite_detenue).toBe('0.00000001');
    expect(position.pru).toBe('50000');
  });
});

describe('valorisation', () => {
  const position = calculerPosition([
    achat('10', '100.00', '5.00', '2026-01-10', 1),
    achat('10', '120.00', '5.00', '2026-02-10', 2),
    vente('5', '150.00', '5.00', '2026-03-10', 3),
  ]);

  it('calcule une plus-value latente positive', () => {
    const valorisee = valoriser(position, '130.00');
    expect(valorisee.valeur).toBe('1950.00');
    expect(valorisee.plus_value_latente).toBe('292.50');
  });

  it('calcule une plus-value latente négative', () => {
    const valorisee = valoriser(position, '100.00');
    expect(valorisee.valeur).toBe('1500.00');
    expect(valorisee.plus_value_latente).toBe('-157.50');
  });

  // Un cours indisponible n'est pas un cours nul : la position est rendue sans
  // valorisation, à charge pour le front de le signaler.
  it("laisse la position non valorisée quand le cours est absent", () => {
    const valorisee = valoriser(position, null);
    expect(valorisee.valeur).toBeNull();
    expect(valorisee.plus_value_latente).toBeNull();
    expect(valorisee.quantite_detenue).toBe('15');
  });

  it('ne calcule pas de pourcentage sur une position soldée', () => {
    const soldee = calculerPosition([
      achat('10', '100.00', '0', '2026-01-10', 1),
      vente('10', '150.00', '0', '2026-02-10', 2),
    ]);
    expect(valoriser(soldee, '150.00').pourcentage_variation).toBeNull();
  });
});

describe('consolidation', () => {
  const positions = [
    { type: 'crypto', valeur: '6000.00', cout_total: '5000.00', plus_value_latente: '1000.00', plus_value_realisee: '200.00' },
    { type: 'action', valeur: '3000.00', cout_total: '2500.00', plus_value_latente: '500.00', plus_value_realisee: '0.00' },
    { type: 'metal', valeur: '1000.00', cout_total: '1200.00', plus_value_latente: '-200.00', plus_value_realisee: '50.00' },
  ];

  it('additionne les valeurs, les coûts et les plus-values', () => {
    const totaux = consolider(positions);
    expect(totaux.valeur_totale).toBe('10000.00');
    expect(totaux.cout_total).toBe('8700.00');
    expect(totaux.plus_value_latente).toBe('1300.00');
    expect(totaux.plus_value_realisee).toBe('250.00');
  });

  it('répartit par classe d\'actif', () => {
    const { repartition } = consolider(positions);
    const parType = Object.fromEntries(repartition.map((r) => [r.type, r.pourcentage]));
    expect(parType.crypto).toBe('60.00');
    expect(parType.action).toBe('30.00');
    expect(parType.metal).toBe('10.00');
  });

  // Une répartition affichée sur un graphique doit totaliser exactement 100 :
  // arrondir chaque part isolément produirait 99,99 % ou 100,01 %.
  it('rend une répartition dont la somme fait exactement 100', () => {
    const troisTiers = [
      { type: 'crypto', valeur: '100.00', cout_total: '100.00', plus_value_latente: '0.00', plus_value_realisee: '0.00' },
      { type: 'action', valeur: '100.00', cout_total: '100.00', plus_value_latente: '0.00', plus_value_realisee: '0.00' },
      { type: 'metal', valeur: '100.00', cout_total: '100.00', plus_value_latente: '0.00', plus_value_realisee: '0.00' },
    ];
    const { repartition } = consolider(troisTiers);
    const somme = repartition.reduce((total, part) => total + Number(part.pourcentage), 0);
    expect(somme).toBe(100);
  });

  it('exclut de la valeur totale les positions sans cours', () => {
    const avecTrou = [
      positions[0],
      { type: 'action', valeur: null, cout_total: '2500.00', plus_value_latente: null, plus_value_realisee: '0.00' },
    ];
    const totaux = consolider(avecTrou);
    expect(totaux.valeur_totale).toBe('6000.00');
    expect(totaux.repartition).toHaveLength(1);
  });

  it('rend une consolidation vide sur un portefeuille sans actif', () => {
    const totaux = consolider([]);
    expect(totaux.valeur_totale).toBe('0.00');
    expect(totaux.repartition).toEqual([]);
  });

  // Variation du patrimoine depuis l'origine, affichée à côté du montant dominant du
  // tableau de bord. Même mécanique que le pourcentage d'une position.
  it('rend la variation relative du patrimoine', () => {
    expect(consolider(positions).pourcentage_variation).toBe('14.94');
  });

  it('rend une variation relative nulle quand le patrimoine vaut son coût', () => {
    const equilibre = [
      { type: 'crypto', valeur: '5000.00', cout_total: '5000.00', plus_value_latente: '0.00', plus_value_realisee: '0.00' },
    ];
    expect(consolider(equilibre).pourcentage_variation).toBe('0.00');
  });

  // Un coût nul ne rend pas un pourcentage infini mais l'absence de pourcentage :
  // portefeuille vide, ou positions reçues sans coût d'acquisition.
  it("n'invente aucun pourcentage lorsque le coût est nul", () => {
    expect(consolider([]).pourcentage_variation).toBeNull();

    const sansCout = [
      { type: 'crypto', valeur: '80.00', cout_total: '0.00', plus_value_latente: '80.00', plus_value_realisee: '0.00' },
    ];
    expect(consolider(sansCout).pourcentage_variation).toBeNull();
  });
});

describe('performance par plage du sélecteur de période', () => {
  // La borne haute est la date du dernier instantané : les plages se lisent donc à
  // rebours du 31 mars, sans dépendre de l'horloge de la machine qui exécute le test.
  const historique = [
    { date_snapshot: '2024-06-30', valeur_totale_eur: '9000.00' },
    { date_snapshot: '2026-01-31', valeur_totale_eur: '9500.00' },
    { date_snapshot: '2026-03-01', valeur_totale_eur: '10000.00' },
    { date_snapshot: '2026-03-24', valeur_totale_eur: '11000.00' },
    { date_snapshot: '2026-03-30', valeur_totale_eur: '12000.00' },
    { date_snapshot: '2026-03-31', valeur_totale_eur: '12600.00' },
  ];

  it('calcule les cinq plages en une fois', () => {
    const performances = calculerPerformances(historique);
    expect(performances.jour).toBe('5.00');
    expect(performances.semaine).toBe('14.55');
    expect(performances.mois).toBe('26.00');
    expect(performances.annee).toBe('32.63');
    expect(performances.origine).toBe('40.00');
  });

  // Un point isolé ne dit rien d'une évolution : mieux vaut l'absence de chiffre qu'un
  // zéro qui se lirait comme une stagnation constatée.
  it('ne calcule aucune plage sous deux points de mesure', () => {
    const performances = calculerPerformances([historique[0]]);
    expect(performances.origine).toBeNull();
    expect(performances.jour).toBeNull();
    expect(calculerPerformances([]).origine).toBeNull();
  });

  it("laisse vide une plage qui ne contient qu'un point", () => {
    const espace = [
      { date_snapshot: '2026-01-01', valeur_totale_eur: '1000.00' },
      { date_snapshot: '2026-06-30', valeur_totale_eur: '1200.00' },
    ];
    const performances = calculerPerformances(espace);
    expect(performances.jour).toBeNull();
    expect(performances.semaine).toBeNull();
    expect(performances.origine).toBe('20.00');
  });

  it('rend une performance négative sans ambiguïté de signe', () => {
    const baisse = [
      { date_snapshot: '2026-03-30', valeur_totale_eur: '1000.00' },
      { date_snapshot: '2026-03-31', valeur_totale_eur: '750.00' },
    ];
    expect(calculerPerformances(baisse).jour).toBe('-25.00');
  });

  // Le portefeuille était vide au départ : la progression n'est pas exprimable en
  // pourcentage, et surtout pas par une division par zéro.
  it('ne divise jamais par une valeur de départ nulle', () => {
    const depuisZero = [
      { date_snapshot: '2026-03-30', valeur_totale_eur: '0.00' },
      { date_snapshot: '2026-03-31', valeur_totale_eur: '500.00' },
    ];
    expect(calculerPerformances(depuisZero).origine).toBeNull();
  });

  // Une plage se compte en jours calendaires : le passage d'un mois à l'autre et
  // l'année bissextile ne doivent pas décaler la borne.
  it('recule correctement par-dessus une fin de mois', () => {
    const surDeuxMois = [
      { date_snapshot: '2026-02-28', valeur_totale_eur: '1000.00' },
      { date_snapshot: '2026-03-01', valeur_totale_eur: '1100.00' },
    ];
    expect(calculerPerformances(surDeuxMois).jour).toBe('10.00');
  });

  // Les plus-values réalisées restent comptabilisées même sans cours courant :
  // elles proviennent de ventes passées, pas d'une valorisation.
  it('comptabilise la plus-value réalisée d\'une position non valorisée', () => {
    const totaux = consolider([
      { type: 'crypto', valeur: null, cout_total: '0.00', plus_value_latente: null, plus_value_realisee: '300.00' },
    ]);
    expect(totaux.plus_value_realisee).toBe('300.00');
  });
});

// Déroulé des mouvements : l'effet de chacun sur le prix de revient.
//
// C'est la colonne la plus difficile à défendre à l'oral, et celle que l'interface ne
// doit surtout pas reconstituer de son côté. Les cas ci-dessous sont les mêmes que ceux
// du calcul de position, relus mouvement par mouvement.
describe('déroulé des mouvements', () => {
  it('rend une liste vide sans transaction', () => {
    expect(derouler([]).mouvements).toEqual([]);
  });

  // Premier achat : le prix de revient part de zéro, l'effet vaut donc le PRU entier.
  it('porte le prix de revient de zéro à sa valeur au premier achat', () => {
    const [mouvement] = derouler([achat('10', '100.00', '5.00')]).mouvements;

    expect(mouvement.pru_avant).toBe('0');
    expect(mouvement.pru_apres).toBe('100.5');
    expect(mouvement.effet_pru).toBe('100.5');
    expect(mouvement.quantite_apres).toBe('10');
    expect(mouvement.montant).toBe('1000.00');
    expect(mouvement.plus_value_realisee).toBeNull();
  });

  // Second achat : 110,50 − 100,50 = 10, vérifiable de tête.
  it('chiffre le déplacement du prix de revient provoqué par un achat', () => {
    const { mouvements } = derouler([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
    ]);

    expect(mouvements[1].pru_avant).toBe('100.5');
    expect(mouvements[1].pru_apres).toBe('110.5');
    expect(mouvements[1].effet_pru).toBe('10');
  });

  // Règle 3 : une vente partielle laisse le prix de revient intact. L'effet est nul,
  // et c'est bien un zéro constaté, pas une donnée absente.
  it("laisse le prix de revient inchangé lors d'une vente partielle", () => {
    const { mouvements } = derouler([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
      vente('5', '150.00', '5.00', '2026-03-10', 3),
    ]);

    expect(mouvements[2].effet_pru).toBe('0');
    expect(mouvements[2].pru_apres).toBe('110.5');
    expect(mouvements[2].quantite_apres).toBe('15');
  });

  // Règle 4, appliquée à une opération et non au cumul : 5 × (150 − 110,50) − 5.
  it('rend la plus-value dégagée par chaque vente prise isolément', () => {
    const { mouvements, position } = derouler([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      achat('10', '120.00', '5.00', '2026-02-10', 2),
      vente('5', '150.00', '5.00', '2026-03-10', 3),
      vente('5', '160.00', '0', '2026-04-10', 4),
    ]);

    expect(mouvements[2].plus_value_realisee).toBe('192.50');
    expect(mouvements[3].plus_value_realisee).toBe('247.50');
    // Le cumul de la position doit être exactement la somme des opérations : si les
    // deux divergeaient, l'écran de détail contredirait le tableau de bord.
    expect(position.plus_value_realisee).toBe('440.00');
  });

  // Règle 5 : la vente qui solde la position remet le prix de revient à zéro. L'effet
  // est alors franchement négatif, et c'est ce chiffre qui explique la remise à zéro.
  it('signale la remise à zéro du prix de revient sur une vente totale', () => {
    const { mouvements } = derouler([
      achat('10', '100.00', '5.00', '2026-01-10', 1),
      vente('10', '150.00', '0', '2026-02-10', 2),
    ]);

    expect(mouvements[1].pru_avant).toBe('100.5');
    expect(mouvements[1].pru_apres).toBe('0');
    expect(mouvements[1].effet_pru).toBe('-100.5');
    expect(mouvements[1].quantite_apres).toBe('0');
  });

  // Règle 6 : le déroulé suit l'ordre chronologique, jamais l'ordre de saisie. Une
  // opération ancienne saisie après coup doit s'insérer à sa date.
  it("déroule dans l'ordre chronologique et non dans l'ordre de saisie", () => {
    const { mouvements } = derouler([
      achat('10', '120.00', '5.00', '2026-02-10', 2),
      achat('10', '100.00', '5.00', '2026-01-10', 1),
    ]);

    expect(mouvements.map((mouvement) => mouvement.id)).toEqual([1, 2]);
    expect(mouvements[0].pru_apres).toBe('100.5');
  });

  // Les champs d'origine de la transaction restent présents : la frise affiche la date,
  // le sens et les frais tels que saisis, à côté des chiffres calculés.
  it("conserve les champs d'origine de la transaction", () => {
    const [mouvement] = derouler([achat('10', '100.00', '5.00', '2026-01-10', 7)]).mouvements;

    expect(mouvement.id).toBe(7);
    expect(mouvement.sens).toBe('achat');
    expect(mouvement.quantite).toBe('10');
    expect(mouvement.frais).toBe('5.00');
    expect(mouvement.date_transaction).toBe('2026-01-10');
  });
});
