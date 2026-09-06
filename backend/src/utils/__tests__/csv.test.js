import { describe, it, expect } from 'vitest';
import { echapper, ligne, construire } from '../csv.js';

describe('échappement CSV', () => {
  it('laisse intact un champ ordinaire', () => {
    expect(echapper('BTC')).toBe('BTC');
    expect(echapper('27000.00')).toBe('27000.00');
  });

  it('encadre un champ contenant le séparateur', () => {
    expect(echapper('Or ; lingot')).toBe('"Or ; lingot"');
  });

  it('double les guillemets et encadre le champ', () => {
    expect(echapper('nom "court"')).toBe('"nom ""court"""');
  });

  it('encadre un champ contenant un saut de ligne', () => {
    expect(echapper('deux\nlignes')).toBe('"deux\nlignes"');
  });

  it('rend une chaîne vide sur une valeur absente', () => {
    expect(echapper(null)).toBe('');
    expect(echapper(undefined)).toBe('');
  });
});

describe('neutralisation des formules de tableur', () => {
  // Le symbole d'un actif est saisi librement : exporté tel quel, un symbole commençant
  // par un signe égal serait exécuté comme une formule à l'ouverture du fichier.
  it("préfixe d'une apostrophe un champ commençant par une amorce de formule", () => {
    expect(echapper('=1+1')).toBe("'=1+1");
    expect(echapper('+BTC')).toBe("'+BTC");
    expect(echapper('-BTC')).toBe("'-BTC");
    expect(echapper('@somme')).toBe("'@somme");
  });

  it('ne préfixe pas un champ dont le signe est ailleurs', () => {
    expect(echapper('BTC-EUR')).toBe('BTC-EUR');
  });

  it('encadre et neutralise à la fois quand les deux sont nécessaires', () => {
    expect(echapper('=a;b')).toBe('"\'=a;b"');
  });
});

describe('construction du fichier', () => {
  it('joint les champs par un point-virgule', () => {
    expect(ligne(['a', 'b', 'c'])).toBe('a;b;c');
  });

  it('sépare les lignes par un CRLF et termine le fichier par un saut de ligne', () => {
    const contenu = construire(['date', 'actif'], [['2026-07-15', 'BTC']]);
    expect(contenu).toBe('date;actif\r\n2026-07-15;BTC\r\n');
  });

  it("rend l'en-tête seul quand il n'y a aucune ligne", () => {
    expect(construire(['date', 'actif'], [])).toBe('date;actif\r\n');
  });
});
