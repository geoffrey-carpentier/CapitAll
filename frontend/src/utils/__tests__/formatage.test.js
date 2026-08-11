import { describe, it, expect } from 'vitest';
import {
  formaterMontant,
  formaterQuantite,
  formaterCours,
  formaterTaux,
  formaterPourcentage,
  formaterVariation,
  amplitudeVariation,
  sensVariation,
} from '../formatage';

// Les séparateurs sont des caractères invisibles : les nommer rend les attentes
// lisibles et évite qu'un espace ordinaire passe pour un espace insécable.
const FINE = ' '; // espace fine insécable, séparateur de milliers
const NBSP = ' '; // espace insécable, devant le symbole
const MOINS = '−'; // signe moins typographique

describe('catégorie 1 — montants', () => {
  it("supprime les zéros de fin : 20,00 s'écrit 20", () => {
    expect(formaterMontant('20.00')).toBe(`20${NBSP}€`);
  });

  it('conserve une seule décimale utile', () => {
    expect(formaterMontant('20.50')).toBe(`20,5${NBSP}€`);
  });

  it('conserve deux décimales utiles', () => {
    expect(formaterMontant('20.25')).toBe(`20,25${NBSP}€`);
  });

  it('groupe les milliers et coupe au centime', () => {
    expect(formaterMontant('12480.6500')).toBe(`12${FINE}480,65${NBSP}€`);
  });

  it('affiche zéro sans décimale', () => {
    expect(formaterMontant('0')).toBe(`0${NBSP}€`);
    expect(formaterMontant('0.00')).toBe(`0${NBSP}€`);
  });

  // Régression identifiée à la conception : une position qui existe ne doit jamais
  // paraître vide. Afficher « 0 € » pour 0,004 € ferait croire à une absence de valeur.
  it("remonte au centime une valeur non nulle inférieure au seuil, jamais 0 €", () => {
    expect(formaterMontant('0.004')).toBe(`0,01${NBSP}€`);
    expect(formaterMontant('0.0001')).toBe(`0,01${NBSP}€`);
    expect(formaterMontant('-0.004')).toBe(`${MOINS}0,01${NBSP}€`);
  });

  it('emploie le signe moins typographique et non le trait d\'union', () => {
    expect(formaterMontant('-135.51')).toBe(`${MOINS}135,51${NBSP}€`);
    expect(formaterMontant('-135.51').startsWith('-')).toBe(false);
  });

  it('arrondit au plus proche, les demis s\'éloignant de zéro', () => {
    expect(formaterMontant('20.255')).toBe(`20,26${NBSP}€`);
    expect(formaterMontant('20.254')).toBe(`20,25${NBSP}€`);
  });

  it('traite les très grands montants sans perte de précision', () => {
    expect(formaterMontant('9876543210.99')).toBe(`9${FINE}876${FINE}543${FINE}210,99${NBSP}€`);
    // Au-delà de ce qu'un flottant représente exactement : la manipulation en chaîne
    // rend le dernier chiffre fidèle, là où Number l'aurait altéré.
    expect(formaterMontant('9007199254740993.01')).toBe(
      `9${FINE}007${FINE}199${FINE}254${FINE}740${FINE}993,01${NBSP}€`
    );
  });

  it('propage la retenue sur un arrondi en cascade', () => {
    expect(formaterMontant('9.999')).toBe(`10${NBSP}€`);
    expect(formaterMontant('999.999')).toBe(`1${FINE}000${NBSP}€`);
  });

  it('refuse une entrée non numérique', () => {
    expect(formaterMontant('abc')).toBeNull();
    expect(formaterMontant('')).toBeNull();
    expect(formaterMontant(null)).toBeNull();
    expect(formaterMontant(undefined)).toBeNull();
  });
});

describe('catégorie 2 — quantités', () => {
  it('affiche une cryptomonnaie à huit décimales avec son symbole', () => {
    expect(formaterQuantite('0.60000001', 'crypto', 'BTC')).toBe(`0,60000001${NBSP}BTC`);
  });

  it('supprime les zéros de fin d\'une quantité', () => {
    expect(formaterQuantite('0.60000000', 'crypto', 'BTC')).toBe(`0,6${NBSP}BTC`);
    expect(formaterQuantite('15.00000000', 'crypto', 'BTC')).toBe(`15${NBSP}BTC`);
    expect(formaterQuantite('0.60000010', 'crypto', 'BTC')).toBe(`0,6000001${NBSP}BTC`);
  });

  it('affiche un métal en grammes, à trois décimales', () => {
    expect(formaterQuantite('18', 'metal')).toBe(`18${NBSP}g`);
    expect(formaterQuantite('620.500', 'metal')).toBe(`620,5${NBSP}g`);
  });

  it('affiche une devise avec son code, à deux décimales', () => {
    expect(formaterQuantite('1500.00', 'devise', 'USD')).toBe(`1${FINE}500${NBSP}USD`);
  });

  // Le pluriel ne vaut que pour les unités nommées en français, jamais pour un symbole
  // ni un code : on écrit 1 BTC, pas 1 BTCs.
  it('accorde en nombre l\'unité des actions', () => {
    expect(formaterQuantite('12', 'action')).toBe(`12${NBSP}titres`);
    expect(formaterQuantite('1', 'action')).toBe(`1${NBSP}titre`);
    expect(formaterQuantite('1.000000', 'action')).toBe(`1${NBSP}titre`);
    expect(formaterQuantite('0.5', 'action')).toBe(`0,5${NBSP}titre`);
    // Le pluriel commence à deux, pas à un : 1,5 reste au singulier.
    expect(formaterQuantite('1.5', 'action')).toBe(`1,5${NBSP}titre`);
    expect(formaterQuantite('2', 'action')).toBe(`2${NBSP}titres`);
  });

  it('refuse une classe d\'actif inconnue', () => {
    expect(formaterQuantite('1', 'obligation')).toBeNull();
    expect(formaterQuantite('1', undefined)).toBeNull();
  });
});

describe('catégorie 3 — cours unitaires, quatre plages', () => {
  it('au moins mille : deux décimales', () => {
    expect(formaterCours('61240')).toBe(`61${FINE}240${NBSP}€`);
    expect(formaterCours('54890.12')).toBe(`54${FINE}890,12${NBSP}€`);
  });

  it('de dix à mille : deux décimales', () => {
    expect(formaterCours('92.14')).toBe(`92,14${NBSP}€`);
    expect(formaterCours('249.6149')).toBe(`249,61${NBSP}€`);
  });

  // C'est ici qu'une règle unique à deux décimales échouerait : le gramme d'argent
  // arrondi à 1,15 introduirait un écart visible entre le cours et le total.
  it('de un centime à dix : quatre décimales', () => {
    expect(formaterCours('1.1523')).toBe(`1,1523${NBSP}€`);
    expect(formaterCours('0.9152')).toBe(`0,9152${NBSP}€`);
    expect(formaterCours('9.99999')).toBe(`10${NBSP}€`);
  });

  it('sous le centime : six décimales', () => {
    expect(formaterCours('0.000842')).toBe(`0,000842${NBSP}€`);
    expect(formaterCours('0.00000012')).toBe(`0${NBSP}€`);
  });

  it('bascule de plage exactement aux bornes', () => {
    expect(formaterCours('10.12345')).toBe(`10,12${NBSP}€`);
    expect(formaterCours('9.12345')).toBe(`9,1235${NBSP}€`);
    expect(formaterCours('0.01234')).toBe(`0,0123${NBSP}€`);
    expect(formaterCours('0.00934')).toBe(`0,00934${NBSP}€`);
  });
});

describe('catégorie 4 — taux de change', () => {
  it('affiche quatre décimales', () => {
    expect(formaterTaux('1.0926')).toBe('1,0926');
  });

  it('supprime les zéros de fin', () => {
    expect(formaterTaux('1.1000')).toBe('1,1');
    expect(formaterTaux('1.0000')).toBe('1');
  });

  it('arrondit au-delà de quatre décimales', () => {
    expect(formaterTaux('1.09265')).toBe('1,0927');
  });
});

describe('catégorie 5 — pourcentages', () => {
  it('supprime la décimale nulle', () => {
    expect(formaterPourcentage('46.0')).toBe(`46${NBSP}%`);
  });

  it('arrondit à une décimale', () => {
    expect(formaterPourcentage('46.04')).toBe(`46${NBSP}%`);
    expect(formaterPourcentage('46.15')).toBe(`46,2${NBSP}%`);
  });

  // Une part qui existe ne s'affiche pas « 0 % » : le seuil bas la rend visible.
  it('affiche un seuil bas pour une part non nulle très faible', () => {
    expect(formaterPourcentage('0.04')).toBe(`<${NBSP}0,1${NBSP}%`);
  });

  it('affiche zéro pour une part réellement nulle', () => {
    expect(formaterPourcentage('0')).toBe(`0${NBSP}%`);
  });
});

describe('catégorie 6 — variations', () => {
  it('impose le signe, y compris au positif', () => {
    expect(formaterVariation('11.6')).toBe(`+11,6${NBSP}%`);
    expect(formaterVariation('6.5')).toBe(`+6,5${NBSP}%`);
  });

  it('emploie le moins typographique au négatif', () => {
    expect(formaterVariation('-6.5')).toBe(`${MOINS}6,5${NBSP}%`);
  });

  // Une variation nulle ne va nulle part : elle ne porte donc pas de signe.
  it('n\'ajoute aucun signe à une variation nulle', () => {
    expect(formaterVariation('0')).toBe(`0${NBSP}%`);
    expect(formaterVariation('0.00')).toBe(`0${NBSP}%`);
  });

  it('applique la règle des montants en mode absolu', () => {
    expect(formaterVariation('393.71', 'absolue')).toBe(`+393,71${NBSP}€`);
    expect(formaterVariation('-135.51', 'absolue')).toBe(`${MOINS}135,51${NBSP}€`);
    expect(formaterVariation('0', 'absolue')).toBe(`0${NBSP}€`);
  });
});

describe('traitement graduel selon l\'amplitude', () => {
  it('classe une amplitude forte à partir de dix pour cent', () => {
    expect(amplitudeVariation('10')).toBe('forte');
    expect(amplitudeVariation('11.6')).toBe('forte');
    expect(amplitudeVariation('-42.8')).toBe('forte');
    expect(amplitudeVariation('250')).toBe('forte');
  });

  it('classe une amplitude moyenne entre un et dix pour cent', () => {
    expect(amplitudeVariation('1')).toBe('moyenne');
    expect(amplitudeVariation('6.5')).toBe('moyenne');
    expect(amplitudeVariation('-9.99')).toBe('moyenne');
  });

  it('classe une amplitude faible sous un pour cent', () => {
    expect(amplitudeVariation('0.9')).toBe('faible');
    expect(amplitudeVariation('-0.01')).toBe('faible');
  });

  it('distingue le cas exactement nul', () => {
    expect(amplitudeVariation('0')).toBe('nulle');
    expect(amplitudeVariation('0.000')).toBe('nulle');
  });

  it('ignore le signe pour déterminer l\'amplitude', () => {
    expect(amplitudeVariation('-11.6')).toBe(amplitudeVariation('11.6'));
  });
});

describe('sens d\'une variation', () => {
  it('distingue hausse, baisse et stabilité', () => {
    expect(sensVariation('11.6')).toBe('hausse');
    expect(sensVariation('-6.5')).toBe('baisse');
    expect(sensVariation('0')).toBe('stable');
    expect(sensVariation('0.00')).toBe('stable');
  });
});

describe('garantie de non-conversion en virgule flottante', () => {
  // Le cœur de la politique : ces valeurs sont exactement celles que Number altère.
  // Si une conversion se glissait dans la chaîne d'affichage, ces tests tomberaient.
  it('rend fidèlement des valeurs qu\'un flottant ne représente pas', () => {
    expect(formaterQuantite('0.10000000', 'crypto', 'BTC')).toBe(`0,1${NBSP}BTC`);
    expect(formaterQuantite('0.30000000', 'crypto', 'BTC')).toBe(`0,3${NBSP}BTC`);
    expect(formaterMontant('0.145')).toBe(`0,15${NBSP}€`);
  });

  it('conserve la précision de quantités que Number arrondirait', () => {
    expect(formaterQuantite('0.00000001', 'crypto', 'BTC')).toBe(`0,00000001${NBSP}BTC`);
    expect(formaterQuantite('123456789.12345678', 'crypto', 'BTC')).toBe(
      `123${FINE}456${FINE}789,12345678${NBSP}BTC`
    );
  });
});
