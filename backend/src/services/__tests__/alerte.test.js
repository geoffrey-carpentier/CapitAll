import { describe, it, expect, vi, beforeAll } from 'vitest';

// Le service tire la configuration par sa chaîne d'imports : environnement minimal
// posé avant l'import dynamique, comme pour les autres modules qui en dépendent.
let creerServiceAlerte;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'd'.repeat(32);
  ({ creerServiceAlerte } = await import('../alerte.js'));
});

// Dépôt et service de portefeuille factices : le service reçoit ses dépendances en
// paramètre, aucune base ni réseau dans ces tests.
function depotAlertes(liste = []) {
  return {
    listerParUtilisateur: vi.fn().mockResolvedValue(liste),
    creerSurActif: vi.fn(),
    creerSurCapitalTotal: vi.fn(),
    desactiver: vi.fn(),
  };
}

function servicePortefeuilleFactice({ capitalTotal = '0', coursParActif = {} } = {}) {
  return { obtenirValeursObservees: vi.fn().mockResolvedValue({ capitalTotal, coursParActif }) };
}

function alerteActif({ id = 1, actifId = 10, sensSeuil = 'au_dessus', valeurSeuil = '70000.00', statut = 'active' } = {}) {
  return {
    id,
    utilisateur_id: 2,
    actif_id: actifId,
    type_cible: 'actif',
    sens_seuil: sensSeuil,
    valeur_seuil: valeurSeuil,
    statut,
    symbole: 'BTC',
  };
}

function alerteCapital({ id = 2, sensSeuil = 'au_dessus', valeurSeuil = '45000.00', statut = 'active' } = {}) {
  return {
    id,
    utilisateur_id: 2,
    actif_id: null,
    type_cible: 'capital_total',
    sens_seuil: sensSeuil,
    valeur_seuil: valeurSeuil,
    statut,
    symbole: null,
  };
}

describe('liste enrichie (E6)', () => {
  it("rend une liste vide sans appeler le portefeuille", async () => {
    const alertes = depotAlertes([]);
    const portefeuille = servicePortefeuilleFactice();
    const service = creerServiceAlerte({ alertes, servicePortefeuille: portefeuille });

    expect(await service.lister(2)).toEqual([]);
    expect(portefeuille.obtenirValeursObservees).not.toHaveBeenCalled();
  });

  it('enrichit une alerte sur actif de la valeur observée et de son écart restant', async () => {
    const alertes = depotAlertes([alerteActif({ valeurSeuil: '65000.00' })]);
    const portefeuille = servicePortefeuilleFactice({ coursParActif: { 10: '61240.00' } });
    const service = creerServiceAlerte({ alertes, servicePortefeuille: portefeuille });

    const [alerte] = await service.lister(2);

    expect(alerte.valeur_observee).toBe('61240.00');
    expect(alerte.ecart_pourcentage).toBe('6.14');
  });

  it('enrichit une alerte sur le capital total à partir du capital observé', async () => {
    const alertes = depotAlertes([alerteCapital({ valeurSeuil: '45000.00' })]);
    const portefeuille = servicePortefeuilleFactice({ capitalTotal: '58566.64' });
    const service = creerServiceAlerte({ alertes, servicePortefeuille: portefeuille });

    const [alerte] = await service.lister(2);

    expect(alerte.valeur_observee).toBe('58566.64');
    expect(alerte.ecart_pourcentage).toBe('0');
  });

  // Cours indisponible sur la cible : les deux champs sont nuls plutôt qu'une valeur
  // inventée, l'écran affichant alors une mention explicite.
  it('rend des champs nuls quand le cours de la cible est indisponible', async () => {
    const alertes = depotAlertes([alerteActif({ actifId: 99 })]);
    const portefeuille = servicePortefeuilleFactice({ coursParActif: {} });
    const service = creerServiceAlerte({ alertes, servicePortefeuille: portefeuille });

    const [alerte] = await service.lister(2);

    expect(alerte.valeur_observee).toBeNull();
    expect(alerte.ecart_pourcentage).toBeNull();
  });

  it('conserve les champs déjà portés par la ligne, symbole compris', async () => {
    const alertes = depotAlertes([alerteActif()]);
    const portefeuille = servicePortefeuilleFactice({ coursParActif: { 10: '70000.00' } });
    const service = creerServiceAlerte({ alertes, servicePortefeuille: portefeuille });

    const [alerte] = await service.lister(2);

    expect(alerte.symbole).toBe('BTC');
    expect(alerte.sens_seuil).toBe('au_dessus');
  });
});

describe('création', () => {
  it('crée une alerte sur le capital total sans consulter les actifs', async () => {
    const alertes = depotAlertes();
    alertes.creerSurCapitalTotal.mockResolvedValue({ id: 5 });
    const service = creerServiceAlerte({ alertes, servicePortefeuille: servicePortefeuilleFactice() });

    const creee = await service.creer({
      utilisateurId: 2,
      donnees: { type_cible: 'capital_total', sens_seuil: 'au_dessus', valeur_seuil: '45000.00' },
    });

    expect(creee).toEqual({ id: 5 });
    expect(alertes.creerSurActif).not.toHaveBeenCalled();
  });

  // Un actif appartenant à un autre compte est indiscernable d'un actif inexistant :
  // le modèle filtre sur le propriétaire, le service ne voit qu'une absence (D52).
  it("rend 404 quand l'actif ciblé n'appartient pas au demandeur", async () => {
    const alertes = depotAlertes();
    alertes.creerSurActif.mockResolvedValue(null);
    const service = creerServiceAlerte({ alertes, servicePortefeuille: servicePortefeuilleFactice() });

    await expect(
      service.creer({
        utilisateurId: 2,
        donnees: { type_cible: 'actif', sens_seuil: 'au_dessus', valeur_seuil: '1.00', actif_id: 99 },
      })
    ).rejects.toMatchObject({ statut: 404 });
  });
});

describe('désactivation', () => {
  it('rend 404 sur une alerte introuvable ou étrangère', async () => {
    const alertes = depotAlertes();
    alertes.desactiver.mockResolvedValue(null);
    const service = creerServiceAlerte({ alertes, servicePortefeuille: servicePortefeuilleFactice() });

    await expect(service.desactiver({ id: 1, utilisateurId: 2 })).rejects.toMatchObject({
      statut: 404,
    });
  });
});
