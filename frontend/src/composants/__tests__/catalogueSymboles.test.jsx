import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeuilleMouvement from '../FeuilleMouvement';
import * as contexte from '../../contexte/contexteAuthentification';
import { api } from '../../services/api';

// Couverture des symboles à la saisie (D27, S-16).
//
// Le champ symbole était une saisie libre pour les quatre classes, alors qu'une seule
// d'entre elles est contrôlée par une liste fermée : l'utilisateur tapait un code
// d'action, validait, et découvrait le refus. Le champ suit désormais ce que le serveur
// déclare accepter.

const CATALOGUE = {
  classes: [
    {
      type: 'crypto',
      couverture: 'ouverte',
      provenance: 'coinbase',
      constate_le: '2026-07-09',
      controle: 'au premier relevé de cours',
      note: 'Toute cryptomonnaie cotée en euros par le fournisseur est acceptée.',
    },
    {
      type: 'metal',
      couverture: 'fermee',
      provenance: 'gold-api',
      constate_le: '2026-07-09',
      controle: 'au premier relevé de cours',
      unite: 'once troy',
      symboles: [
        { symbole: 'XAU', nom: 'Or' },
        { symbole: 'XAG', nom: 'Argent' },
      ],
      note: 'Cotation par once troy.',
    },
    {
      type: 'action',
      couverture: 'fermee',
      provenance: 'Financial Modeling Prep, plan gratuit',
      constate_le: '2026-07-21',
      controle: 'à la saisie',
      symboles: [{ symbole: 'AAPL' }, { symbole: 'TSLA' }],
      note: 'Liste fermée actée en D27.',
    },
  ],
};

// Portefeuille vide : la feuille s'ouvre directement sur la création d'un actif, qui est
// exactement l'écran à vérifier ici.
function rendre() {
  return render(
    <FeuilleMouvement actifs={[]} surFermeture={() => {}} surEnregistrement={() => {}} />
  );
}

beforeEach(() => {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });
  vi.spyOn(api, 'symboles').mockResolvedValue(CATALOGUE);
  vi.spyOn(api, 'creerActif').mockResolvedValue({
    id: 9,
    utilisateur_id: 2,
    type: 'action',
    symbole: 'AAPL',
    nom: 'Apple',
    date_ajout: '2026-09-05T10:00:00.000Z',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('champ symbole selon la couverture de la classe', () => {
  it('reste une saisie libre pour une classe que seul le fournisseur connaît', async () => {
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    const champ = screen.getByLabelText(/^Symbole/);
    expect(champ.tagName).toBe('INPUT');
  });

  it('propose un choix pour une classe dont la liste est connue', async () => {
    const utilisateur = userEvent.setup();
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    await utilisateur.selectOptions(screen.getByLabelText(/^Classe/), 'action');

    const champ = screen.getByLabelText(/^Symbole/);
    expect(champ.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'AAPL' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'TSLA' })).toBeTruthy();
  });

  it('accole le nom au symbole quand la couverture le porte', async () => {
    const utilisateur = userEvent.setup();
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    await utilisateur.selectOptions(screen.getByLabelText(/^Classe/), 'metal');

    expect(screen.getByRole('option', { name: 'XAU — Or' })).toBeTruthy();
  });

  it('annonce la provenance et la date de la couverture', async () => {
    const utilisateur = userEvent.setup();
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    await utilisateur.selectOptions(screen.getByLabelText(/^Classe/), 'action');

    // Une liste sans date est une liste dont personne ne peut dire si elle est encore
    // vraie : les deux voyagent ensemble jusque sous le champ.
    expect(screen.getByText(/Financial Modeling Prep/)).toBeTruthy();
    expect(screen.getByText(/21\/07\/2026/)).toBeTruthy();
  });

  it('vide le symbole en changeant de classe', async () => {
    const utilisateur = userEvent.setup();
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    await utilisateur.type(screen.getByLabelText(/^Symbole/), 'BTC');
    await utilisateur.selectOptions(screen.getByLabelText(/^Classe/), 'action');

    // BTC n'a rien à faire dans une liste d'actions, et une valeur restée en place
    // partirait au serveur.
    expect(screen.getByLabelText(/^Symbole/).value).toBe('');
  });

  it('retombe sur une saisie libre si le catalogue n’arrive pas', async () => {
    // Le catalogue est un confort, pas une condition : une panne ne doit pas rendre la
    // création d'actif impossible. Le serveur reste seul juge, comme avant.
    vi.spyOn(api, 'symboles').mockRejectedValue(new Error('injoignable'));
    const utilisateur = userEvent.setup();
    rendre();

    await waitFor(() => {
      expect(api.symboles).toHaveBeenCalled();
    });

    await utilisateur.selectOptions(screen.getByLabelText(/^Classe/), 'action');
    expect(screen.getByLabelText(/^Symbole/).tagName).toBe('INPUT');
  });
});
