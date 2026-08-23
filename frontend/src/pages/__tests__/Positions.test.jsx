import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Positions from '../Positions';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// L'écran est testé sur ses interactions et ses états. Le tri et le filtrage sont ce qui
// se casse en silence : une liste mal ordonnée reste une liste plausible.

const POSITIONS = [
  {
    id: 1,
    type: 'crypto',
    symbole: 'BTC',
    nom: 'Bitcoin',
    cours_eur: '54890.12',
    source_cours: 'fournisseur',
    horodatage_cours: '2026-08-23T08:00:00Z',
    quantite_detenue: '0.6',
    pru: '41000.00',
    cout_total: '24600.00',
    valeur: '32934.07',
    plus_value_latente: '8334.07',
    plus_value_realisee: '0.00',
    pourcentage_variation: '33.88',
  },
  {
    id: 2,
    type: 'metal',
    symbole: 'XAU',
    nom: 'Or',
    cours_eur: '92.14',
    source_cours: 'fournisseur',
    horodatage_cours: '2026-08-23T08:00:00Z',
    quantite_detenue: '128.5',
    pru: '78.20',
    cout_total: '10048.70',
    valeur: '11839.99',
    plus_value_latente: '1791.29',
    plus_value_realisee: '0.00',
    pourcentage_variation: '17.83',
  },
  {
    id: 3,
    type: 'devise',
    symbole: 'USD',
    nom: 'Dollar américain',
    cours_eur: '0.8547',
    source_cours: 'repli',
    horodatage_cours: '2026-08-21T00:00:00Z',
    quantite_detenue: '5000',
    pru: '0.9100',
    cout_total: '4550.00',
    valeur: '4273.50',
    plus_value_latente: '-276.50',
    plus_value_realisee: '0.00',
    pourcentage_variation: '-6.07',
  },
];

const PORTEFEUILLE = {
  valeur_totale: '49047.56',
  cout_total: '39198.70',
  plus_value_latente: '9848.86',
  plus_value_realisee: '0.00',
  pourcentage_variation: '25.12',
  repartition: [],
  actifs: POSITIONS,
  cours_indisponibles: [],
  taux_affichage: { eur_vers_usd: '1.1699', usd_vers_eur: '0.85477', horodatage: '2026-08-23T00:00:00Z' },
  alertes_declenchees: [],
};

// Sonde d'adresse : le filtre doit être lisible dans l'URL pour être partageable.
let adresse = null;
function Sonde() {
  adresse = useLocation();
  return null;
}

function rendre(entree = '/positions') {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });

  return render(
    <MemoryRouter initialEntries={[entree]}>
      <Sonde />
      <Routes>
        <Route path="/positions" element={<Positions />} />
        <Route path="/positions/:id" element={<p>Détail de la position</p>} />
      </Routes>
    </MemoryRouter>
  );
}

// Le tableau desktop et la liste mobile sont tous deux dans le document, l'un des deux
// étant écarté par la feuille de style que jsdom n'applique pas. Les assertions visent
// donc explicitement l'une ou l'autre structure.
function lignesDuTableau() {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((ligne) => within(ligne).getAllByRole('rowheader')[0].textContent);
}

beforeEach(() => {
  vi.spyOn(api, 'portefeuille').mockResolvedValue(PORTEFEUILLE);
  window.sessionStorage.clear();
  adresse = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('tri', () => {
  // Répondre d'emblée à « qu'est-ce qui pèse le plus » sans avoir à cliquer.
  it('trie par valorisation décroissante par défaut', async () => {
    rendre();
    await screen.findByRole('table');

    expect(lignesDuTableau().map((l) => l.slice(0, 20))).toEqual([
      expect.stringContaining('Bitcoin'),
      expect.stringContaining('Or'),
      expect.stringContaining('Dollar'),
    ]);
  });

  it('inverse le sens au second clic sur la même colonne', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    await utilisateur.click(screen.getByRole('button', { name: /Valorisation/ }));
    expect(lignesDuTableau()[0]).toContain('Dollar');

    await utilisateur.click(screen.getByRole('button', { name: /Valorisation/ }));
    expect(lignesDuTableau()[0]).toContain('Bitcoin');
  });

  // Une plus-value négative doit se ranger sous les positives, pas être comparée en
  // valeur absolue.
  it('ordonne les plus-values en tenant compte du signe', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    await utilisateur.click(screen.getByRole('button', { name: /Plus-value/ }));
    expect(lignesDuTableau()[2]).toContain('Dollar');
  });

  it('annonce la colonne triée et elle seule', async () => {
    rendre();
    await screen.findByRole('table');

    const entetes = screen.getAllByRole('columnheader');
    const triees = entetes.filter((e) => e.getAttribute('aria-sort') === 'descending');

    expect(triees).toHaveLength(1);
    expect(triees[0].textContent).toContain('Valorisation');
    // La colonne du nom n'est pas triable : elle ne porte pas l'attribut du tout.
    expect(entetes[0].hasAttribute('aria-sort')).toBe(false);
  });

  it('reflète le tri dans l\'adresse et le relit au chargement', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    await utilisateur.click(screen.getByRole('button', { name: /Quantité/ }));
    expect(adresse.search).toContain('tri=quantite_detenue');

    cleanup();
    rendre('/positions?tri=cours_eur&sens=asc');
    await screen.findByRole('table');
    expect(lignesDuTableau()[0]).toContain('Dollar');
  });

  it('ignore une clé de tri inconnue plutôt que de rendre une liste au hasard', async () => {
    rendre('/positions?tri=mot_de_passe');
    await screen.findByRole('table');

    expect(lignesDuTableau()[0]).toContain('Bitcoin');
  });
});

describe('filtres par classe', () => {
  it('compte les positions de chaque classe sur la totalité, pas sur le reste', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    const filtreCrypto = screen.getByRole('button', { name: /Cryptomonnaie, 1 position/ });
    await utilisateur.click(filtreCrypto);

    // Le compteur des autres classes ne bouge pas : ce sont des repères, pas un reste.
    expect(screen.getByRole('button', { name: /Métal précieux, 1 position/ })).toBeTruthy();
    expect(lignesDuTableau()).toHaveLength(1);
  });

  it('cumule les filtres et les inscrit dans l\'adresse', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    await utilisateur.click(screen.getByRole('button', { name: /Cryptomonnaie/ }));
    await utilisateur.click(screen.getByRole('button', { name: /Métal précieux/ }));

    expect(lignesDuTableau()).toHaveLength(2);
    expect(adresse.search).toContain('classes=crypto%2Cmetal');
  });

  it('applique un filtre reçu par l\'adresse', async () => {
    rendre('/positions?classes=devise');
    await screen.findByRole('table');

    expect(lignesDuTableau()).toHaveLength(1);
    expect(lignesDuTableau()[0]).toContain('Dollar');
    expect(screen.getByRole('button', { name: /Devise/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('écarte une classe inventée dans l\'adresse', async () => {
    rendre('/positions?classes=obligation');
    await screen.findByRole('table');

    expect(lignesDuTableau()).toHaveLength(3);
  });
});

describe('états', () => {
  it('affiche un squelette en forme de liste pendant le chargement', () => {
    api.portefeuille.mockReturnValue(new Promise(() => {}));
    const { container } = rendre();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelectorAll('.squelette').length).toBeGreaterThan(0);
  });

  // Un portefeuille vide et une liste vidée par un filtre ne se disent pas de la même
  // façon : le premier propose de créer, le second de réinitialiser.
  it('distingue un portefeuille vide d\'une absence de résultat après filtrage', async () => {
    const utilisateur = userEvent.setup();
    rendre('/positions?classes=crypto');
    await screen.findByRole('table');

    await utilisateur.click(screen.getByRole('button', { name: /Cryptomonnaie/ }));
    await utilisateur.click(screen.getByRole('button', { name: /Devise/ }));
    await utilisateur.click(screen.getByRole('button', { name: /Métal précieux/ }));

    // Rien ne correspond : l'en-tête et les filtres restent affichés.
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [POSITIONS[0]] });
    cleanup();

    rendre('/positions?classes=devise');
    expect(await screen.findByText(/Aucune position ne correspond/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Réinitialiser/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Positions/ })).toBeTruthy();
  });

  it('propose de créer une position sur un portefeuille vide', async () => {
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [] });
    rendre();

    expect(await screen.findByText('Aucune position')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ajouter une position/ })).toBeTruthy();
    // Ce n'est pas un filtrage : aucun bouton de réinitialisation.
    expect(screen.queryByRole('button', { name: /Réinitialiser/ })).toBeNull();
  });

  it('réinitialise les filtres et retrouve la liste complète', async () => {
    const utilisateur = userEvent.setup();
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [POSITIONS[0]] });
    rendre('/positions?classes=devise');

    await utilisateur.click(await screen.findByRole('button', { name: /Réinitialiser/ }));
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('distingue une erreur du serveur d\'une coupure réseau', async () => {
    api.portefeuille.mockRejectedValue(new ErreurApi('Service indisponible.', 500));
    const { unmount } = rendre();
    expect(await screen.findByText('Données indisponibles')).toBeTruthy();
    unmount();

    api.portefeuille.mockRejectedValue(new ErreurApi('Le serveur est injoignable.', 0));
    rendre();
    expect(await screen.findByText('Connexion indisponible')).toBeTruthy();
  });

  it('signale un repli sur le dernier cours connu', async () => {
    rendre();

    const bandeau = await screen.findByText(/dernier cours connu/);
    expect(bandeau.textContent).toContain('USD');
    expect(bandeau.closest('.message').className).toContain('message--avertissement');
  });

  it('nomme les actifs dont aucun cours n\'a pu être obtenu', async () => {
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, cours_indisponibles: ['AAPL'] });
    rendre();

    expect(await screen.findByText(/AAPL/)).toBeTruthy();
  });
});

describe('accessibilité et affichage', () => {
  it('donne à chaque lien de la liste un texte qui nomme la position et sa valeur', async () => {
    rendre();
    await screen.findByRole('table');

    // Le lien de la liste mobile, celui qui est parcouru à la voix.
    const lien = screen.getByRole('link', { name: /Bitcoin, Cryptomonnaie, valorisée/ });
    expect(lien.getAttribute('href')).toBe('/positions/1');
  });

  it('convertit toutes les colonnes de montants en une seule fois', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    const appelsAvant = api.portefeuille.mock.calls.length;
    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));

    // 32934,07 x 1,1699 = 38529,568493, arrondi au centime, et aucune requête de plus.
    expect(await screen.findAllByText(/38.529,57/)).toBeTruthy();
    expect(api.portefeuille.mock.calls.length).toBe(appelsAvant);
  });

  it('masque les montants sans masquer la structure de la liste', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('table');

    await utilisateur.click(screen.getByLabelText('Masquer les montants'));

    expect(screen.queryByText(/32.934,07/)).toBeNull();
    // Les lignes restent là, avec leur nom : seule la valeur est cachée.
    expect(lignesDuTableau()).toHaveLength(3);
  });
});
