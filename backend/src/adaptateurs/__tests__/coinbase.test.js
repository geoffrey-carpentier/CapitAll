import { describe, it, expect, vi } from 'vitest';
import { creerAdaptateurCoinbase } from '../coinbase.js';

// Réponse réelle simplifiée : Coinbase renvoie plusieurs centaines de paires et des
// valeurs en chaîne de caractères.
function reponseCoinbase(rates) {
  return { data: { currency: 'BTC', rates } };
}

describe('adaptateur Coinbase', () => {
  it('extrait le cours en euros et rend la forme commune', async () => {
    const recupererJson = vi.fn().mockResolvedValue(
      reponseCoinbase({ EUR: '62704.64', USD: '73010.96', GBP: '54000.00' })
    );
    const adaptateur = creerAdaptateurCoinbase({ recupererJson });

    const cours = await adaptateur.getCours('btc');

    expect(cours.symbole).toBe('BTC');
    expect(cours.cours_eur).toBe('62704.64');
    expect(cours.source).toBe('coinbase');
    expect(typeof cours.horodatage).toBe('string');
  });

  it('interroge le bon endpoint avec le symbole en majuscules', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseCoinbase({ EUR: '2750.00' }));
    const adaptateur = creerAdaptateurCoinbase({ recupererJson });

    await adaptateur.getCours('eth');

    expect(recupererJson).toHaveBeenCalledWith(
      'https://api.coinbase.com/v2/exchange-rates?currency=ETH'
    );
  });

  // La valeur ne doit jamais passer par Number : sur des montants financiers, la
  // conversion en flottant introduirait une imprécision définitive (D4).
  it('conserve la valeur en chaîne, sans conversion', async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseCoinbase({ EUR: '0.00000001' }));
    const adaptateur = creerAdaptateurCoinbase({ recupererJson });

    const cours = await adaptateur.getCours('SHIB');

    expect(cours.cours_eur).toBe('0.00000001');
    expect(typeof cours.cours_eur).toBe('string');
  });

  it("rejette une réponse sans ligne EUR, avec un message explicite", async () => {
    const recupererJson = vi.fn().mockResolvedValue(reponseCoinbase({ USD: '73010.96' }));
    const adaptateur = creerAdaptateurCoinbase({ recupererJson });

    await expect(adaptateur.getCours('BTC')).rejects.toThrow(/euros pour BTC/);
  });

  it('rejette une réponse malformée', async () => {
    const recupererJson = vi.fn().mockResolvedValue({ erreur: 'symbole inconnu' });
    const adaptateur = creerAdaptateurCoinbase({ recupererJson });

    await expect(adaptateur.getCours('INEXISTANT')).rejects.toThrow();
  });
});
