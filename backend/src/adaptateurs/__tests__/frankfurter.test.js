import { describe, it, expect, vi } from 'vitest';
import { creerAdaptateurFrankfurter, inverserTaux } from '../frankfurter.js';

function reponseFrankfurter(symbole, taux, date = '2026-07-20') {
  return { amount: 1.0, base: 'EUR', date, rates: { [symbole]: taux } };
}

describe('adaptateur Frankfurter', () => {
  // Garde-fou principal du lot. Frankfurter cote depuis l'euro : rates.USD = 1.25
  // signifie qu'un euro vaut 1,25 dollar, donc qu'un dollar vaut 0,80 euro.
  // Renvoyer 1.25 au lieu de 0.8 donnerait un portefeuille faux sans rien signaler.
  it('inverse le taux : 1 EUR = 1.25 USD donne 1 USD = 0.8 EUR', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseFrankfurter('USD', 1.25));
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    const cours = await adaptateur.getCours('USD');

    expect(cours.cours_eur).toBe('0.8');
  });

  it('inverse correctement un taux réel', () => {
    // 1 / 1.1426 = 0.87519692... arrondi à 8 décimales
    expect(inverserTaux(1.1426)).toBe('0.87519692');
  });

  it('rend la forme commune et la source', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseFrankfurter('GBP', 0.85));
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    const cours = await adaptateur.getCours('gbp');

    expect(cours.symbole).toBe('GBP');
    expect(cours.source).toBe('frankfurter');
    expect(Number(cours.cours_eur)).toBeCloseTo(1 / 0.85, 6);
  });

  // Les taux BCE ne sont publiés que les jours ouvrés : une date antérieure au jour
  // courant est le fonctionnement normal, pas une panne. Elle est remontée telle quelle.
  it("remonte la date du taux telle quelle, même antérieure au jour courant", async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseFrankfurter('USD', 1.1426, '2026-07-17'));
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    const cours = await adaptateur.getCours('USD');

    expect(cours.horodatage.startsWith('2026-07-17')).toBe(true);
  });

  it("ne fait aucun appel réseau pour l'euro, qui vaut 1 par définition", async () => {
    const recupererJson = vi.fn();
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    const cours = await adaptateur.getCours('EUR');

    expect(cours.cours_eur).toBe('1');
    expect(recupererJson).not.toHaveBeenCalled();
  });

  it('rejette une réponse sans taux pour le symbole demandé', async () => {
    const recupererJson = vi.fn().mockResolvedValue({ base: 'EUR', date: '2026-07-20', rates: {} });
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    await expect(adaptateur.getCours('XYZ')).rejects.toThrow(/pas renvoyé de taux/);
  });

  it('expose le taux USD vers EUR pour la conversion des métaux', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseFrankfurter('USD', 1.25));
    const adaptateur = creerAdaptateurFrankfurter({ recupererJson });

    expect(await adaptateur.obtenirTauxUsdEur()).toBe('0.8');
  });
});
