import { describe, it, expect, vi } from 'vitest';
import { creerAdaptateurActions } from '../actions.js';

const CLES_FACTICES = {
  fmpApiKey: 'cle-fmp-de-test',
  finnhubApiKey: 'cle-finnhub-de-test',
  alphaVantageApiKey: 'cle-alpha-de-test',
};

function creer({ recupererJson, obtenirTauxUsdEur, cles = CLES_FACTICES }) {
  return creerAdaptateurActions({
    recupererJson,
    obtenirTauxUsdEur: obtenirTauxUsdEur ?? vi.fn().mockResolvedValue('0.8'),
    ...cles,
  });
}

describe('adaptateur actions', () => {
  it('utilise FMP en priorité et convertit le cours USD en EUR', async () => {
    const recupererJson = vi.fn().mockResolvedValue([
      { symbol: 'AAPL', price: 200, timestamp: 1788170400 },
    ]);
    const adaptateur = creer({ recupererJson });

    const cours = await adaptateur.getCours('aapl');

    expect(cours).toEqual({
      symbole: 'AAPL',
      // Plus d'arrondi au centime a l'entree : le cours entre dans la chaine avec sa
      // precision, et c'est l'affichage qui decide de ce qu'il en montre.
      cours_eur: '160',
      horodatage: new Date(1788170400 * 1000).toISOString(),
      source: 'fmp',
    });
    expect(recupererJson).toHaveBeenCalledWith(
      'https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=cle-fmp-de-test'
    );
  });

  it('se replie sur Finnhub lorsque FMP échoue', async () => {
    const recupererJson = vi
      .fn()
      .mockRejectedValueOnce(new Error('FMP indisponible'))
      .mockResolvedValueOnce({ c: 250, t: 1788170400 });
    const adaptateur = creer({ recupererJson });

    const cours = await adaptateur.getCours('MSFT');

    expect(cours.cours_eur).toBe('200');
    expect(cours.source).toBe('finnhub');
    expect(recupererJson).toHaveBeenNthCalledWith(
      2,
      'https://finnhub.io/api/v1/quote?symbol=MSFT&token=cle-finnhub-de-test'
    );
  });

  it('se replie en dernier lieu sur Alpha Vantage', async () => {
    const recupererJson = vi
      .fn()
      .mockRejectedValueOnce(new Error('FMP indisponible'))
      .mockRejectedValueOnce(new Error('Finnhub indisponible'))
      .mockResolvedValueOnce({
        'Global Quote': {
          '05. price': '125.50',
          '07. latest trading day': '2026-08-28',
        },
      });
    const adaptateur = creer({ recupererJson });

    const cours = await adaptateur.getCours('NVDA');

    expect(cours.cours_eur).toBe('100.4');
    expect(cours.source).toBe('alpha-vantage');
    expect(cours.horodatage).toBe('2026-08-28T00:00:00.000Z');
  });

  it('ignore les fournisseurs sans clé et ne place aucune clé dans une erreur', async () => {
    const recupererJson = vi.fn();
    const adaptateur = creer({ recupererJson, cles: {} });

    await expect(adaptateur.getCours('AAPL')).rejects.toThrow(/Aucune clé/);
    expect(recupererJson).not.toHaveBeenCalled();
  });

  it('rejette une cotation inexploitable après avoir essayé les replis configurés', async () => {
    const recupererJson = vi.fn().mockResolvedValue({});
    const adaptateur = creer({ recupererJson });

    await expect(adaptateur.getCours('AAPL')).rejects.toThrow(/FMP, Finnhub, Alpha Vantage/);
    expect(recupererJson).toHaveBeenCalledTimes(3);
  });
});
