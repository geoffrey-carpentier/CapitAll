import { describe, it, expect, vi } from 'vitest';
import { creerAdaptateurMetal } from '../metal.js';

function reponseGoldApi(price, updatedAt = '2026-07-20T17:12:30Z') {
  return {
    currency: 'USD',
    currencySymbol: '$',
    exchangeRate: 1.0,
    name: 'Gold',
    price,
    symbol: 'XAU',
    updatedAt,
  };
}

describe('adaptateur gold-api', () => {
  // Cas chiffré vérifiable à la main : 2000 dollars l'once, un dollar valant 0,80 euro,
  // donne 1600 euros l'once. C'est le piège principal de ce fournisseur, dont le prix
  // n'est jamais libellé en euros.
  it('convertit le prix en dollars par once au taux injecté', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseGoldApi(2000));
    const obtenirTauxUsdEur = vi.fn().mockResolvedValue('0.8');
    const adaptateur = creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur });

    const cours = await adaptateur.getCours('XAU');

    expect(cours.cours_eur).toBe('1600.00');
    expect(cours.symbole).toBe('XAU');
    expect(cours.source).toBe('gold-api');
  });

  it('interroge le bon endpoint', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseGoldApi(1000));
    const obtenirTauxUsdEur = vi.fn().mockResolvedValue('0.9');
    const adaptateur = creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur });

    await adaptateur.getCours('xag');

    expect(recupererJson).toHaveBeenCalledWith('https://api.gold-api.com/price/XAG');
  });

  it("remonte l'horodatage du fournisseur", async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseGoldApi(4012.300049));
    const obtenirTauxUsdEur = vi.fn().mockResolvedValue('0.87519692');
    const adaptateur = creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur });

    const cours = await adaptateur.getCours('XAU');

    expect(cours.horodatage.startsWith('2026-07-20')).toBe(true);
  });

  it('rejette une réponse sans prix exploitable', async () => {
    const recupererJson = vi.fn().mockResolvedValue({ symbol: 'XAU', name: 'Gold' });
    const obtenirTauxUsdEur = vi.fn().mockResolvedValue('0.8');
    const adaptateur = creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur });

    await expect(adaptateur.getCours('XAU')).rejects.toThrow(/pas renvoyé de prix/);
  });

  // Sans taux de change, la conversion est impossible : mieux vaut une erreur claire
  // qu'un cours libellé en dollars présenté comme des euros.
  it('rejette si le taux de change est indisponible', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseGoldApi(2000));
    const obtenirTauxUsdEur = vi.fn().mockResolvedValue(null);
    const adaptateur = creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur });

    await expect(adaptateur.getCours('XAU')).rejects.toThrow(/Taux de change/);
  });
});
