import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Le service tire la configuration par sa chaîne d'imports (cache Redis). Un
// environnement minimal est posé avant l'import dynamique, comme pour les autres
// modules dépendant de la configuration.
let creerServiceCours;
let DUREES_VIE_SECONDES;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'c'.repeat(32);
  ({ creerServiceCours, DUREES_VIE_SECONDES } = await import('../cours.js'));
});

const COURS_BTC = {
  symbole: 'BTC',
  cours_eur: '62704.64',
  horodatage: '2026-07-29T10:00:00.000Z',
  source: 'coinbase',
};

// Doublure de cache : ni Redis ni réseau, les tests restent unitaires.
function creerCacheFactice({ enCache = null, dernierConnu = null } = {}) {
  return {
    lireCoursCache: vi.fn().mockResolvedValue(enCache),
    ecrireCoursCache: vi.fn().mockResolvedValue(undefined),
    lireDernierCoursConnu: vi.fn().mockResolvedValue(dernierConnu),
    ecrireDernierCoursConnu: vi.fn().mockResolvedValue(undefined),
  };
}

function creerAdaptateursFactices(getCours) {
  return { obtenirAdaptateur: vi.fn().mockReturnValue({ getCours }) };
}

let getCoursAdaptateur;

beforeEach(() => {
  getCoursAdaptateur = vi.fn().mockResolvedValue(COURS_BTC);
});

describe('service de cours', () => {
  it("sert depuis le cache sans appeler le fournisseur", async () => {
    const cache = creerCacheFactice({ enCache: COURS_BTC });
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(getCoursAdaptateur),
      cache,
    });

    const cours = await service.getCours('BTC', 'crypto');

    expect(cours.source).toBe('cache');
    expect(cours.cours_eur).toBe('62704.64');
    // Le point essentiel : aucun appel sortant lorsque le cache répond.
    expect(getCoursAdaptateur).not.toHaveBeenCalled();
  });

  it("appelle le fournisseur quand le cache est vide, puis écrit les deux clés", async () => {
    const cache = creerCacheFactice();
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(getCoursAdaptateur),
      cache,
    });

    const cours = await service.getCours('BTC', 'crypto');

    expect(cours.source).toBe('fournisseur');
    expect(getCoursAdaptateur).toHaveBeenCalledTimes(1);
    expect(cache.ecrireCoursCache).toHaveBeenCalledTimes(1);
    expect(cache.ecrireDernierCoursConnu).toHaveBeenCalledTimes(1);
  });

  // TTL différenciés par classe d'actif (D21).
  it('transmet le TTL correspondant au type demandé', async () => {
    const cas = [
      ['crypto', DUREES_VIE_SECONDES.crypto],
      ['devise', DUREES_VIE_SECONDES.devise],
      ['metal', DUREES_VIE_SECONDES.metal],
      ['action', DUREES_VIE_SECONDES.action],
    ];

    for (const [type, ttlAttendu] of cas) {
      const cache = creerCacheFactice();
      const service = creerServiceCours({
        adaptateurs: creerAdaptateursFactices(getCoursAdaptateur),
        cache,
      });

      await service.getCours('SYM', type);

      // La classe précède le symbole : les deux forment l'identité du cours en cache.
      expect(cache.ecrireCoursCache).toHaveBeenCalledWith(
        type,
        'SYM',
        expect.anything(),
        ttlAttendu
      );
    }
  });

  it('respecte les valeurs de TTL actées en D21', () => {
    expect(DUREES_VIE_SECONDES.crypto).toBe(120);
    expect(DUREES_VIE_SECONDES.devise).toBe(3600);
    expect(DUREES_VIE_SECONDES.metal).toBe(600);
    expect(DUREES_VIE_SECONDES.action).toBe(300);
  });

  it("renvoie le dernier cours connu quand le fournisseur échoue", async () => {
    const cache = creerCacheFactice({ dernierConnu: COURS_BTC });
    const enEchec = vi.fn().mockRejectedValue(new Error('fournisseur injoignable'));
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(enEchec),
      cache,
    });

    const cours = await service.getCours('BTC', 'crypto');

    expect(cours.source).toBe('repli');
    // L'horodatage d'origine est conservé : le front doit pouvoir afficher la date
    // réelle du cours, pas celle de la tentative ratée.
    expect(cours.horodatage).toBe(COURS_BTC.horodatage);
  });

  it("lève une erreur quand le fournisseur échoue et que le repli est vide", async () => {
    const cache = creerCacheFactice();
    const enEchec = vi.fn().mockRejectedValue(new Error('fournisseur injoignable'));
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(enEchec),
      cache,
    });

    await expect(service.getCours('BTC', 'crypto')).rejects.toThrow(/aucun cours connu/);
  });

  it("route également les actions vers l'adaptateur configuré", async () => {
    const cache = creerCacheFactice();
    const adaptateurs = creerAdaptateursFactices(getCoursAdaptateur);
    const service = creerServiceCours({ adaptateurs, cache });

    await service.getCours('AAPL', 'action');

    expect(adaptateurs.obtenirAdaptateur).toHaveBeenCalledWith('action');
  });
});

describe('cours multiples', () => {
  it('déduplique les symboles avant d\'appeler le fournisseur', async () => {
    const cache = creerCacheFactice();
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(getCoursAdaptateur),
      cache,
    });

    const resultats = await service.getCoursMultiples([
      { symbole: 'BTC', type: 'crypto' },
      { symbole: 'btc', type: 'crypto' },
      { symbole: 'ETH', type: 'crypto' },
    ]);

    expect(resultats).toHaveLength(2);
    expect(getCoursAdaptateur).toHaveBeenCalledTimes(2);
  });

  // Un symbole en échec ne doit pas priver le tableau de bord de tous les autres.
  it("isole l'échec d'un symbole sans faire échouer les autres", async () => {
    const cache = creerCacheFactice();
    const capricieux = vi
      .fn()
      .mockResolvedValueOnce(COURS_BTC)
      .mockRejectedValueOnce(new Error('injoignable'));
    const service = creerServiceCours({
      adaptateurs: creerAdaptateursFactices(capricieux),
      cache,
    });

    const resultats = await service.getCoursMultiples([
      { symbole: 'BTC', type: 'crypto' },
      { symbole: 'ETH', type: 'crypto' },
    ]);

    expect(resultats).toHaveLength(2);
    expect(resultats.filter((r) => r.erreur)).toHaveLength(1);
  });
});
