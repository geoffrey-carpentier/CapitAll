import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeuilleMouvement from '../FeuilleMouvement';
import FriseMouvements from '../FriseMouvements';
import * as contexte from '../../contexte/contexteAuthentification';
import { api } from '../../services/api';

// Correction d'un mouvement enregistré, côté interface (D51 révisée).
//
// Ce que ces tests protègent : que la feuille parte des valeurs du mouvement au lieu
// d'un formulaire vide, qu'elle appelle la route de correction et non celle de création,
// et qu'elle interdise de déplacer un mouvement vers une autre position. Le troisième
// point est le moins visible et le plus coûteux à rattraper : une correction qui
// changerait d'actif détacherait le mouvement de l'histoire qui l'explique.

const POSITION = {
  id: 1,
  type: 'crypto',
  symbole: 'BTC',
  nom: 'Bitcoin',
  cours_eur: '60801.20',
  source_cours: 'coinbase',
  quantite_detenue: '0.1',
  pru: '54030',
};

const ACHAT = {
  id: 12,
  sens: 'achat',
  quantite: '0.5',
  prix_unitaire: '54000',
  frais: '15.00',
  frais_montant: '15.00',
  frais_unite: 'EUR',
  montant: '27000.00',
  effet_pru: '54030',
  plus_value_realisee: null,
  cout_sortie: null,
  date_transaction: '2026-05-27T12:00:00.000Z',
  note: 'Achat initial',
};

const EFFET_CORRECTION = {
  sens: 'achat',
  montant: '26000.00',
  frais: '15.00',
  frais_montant: '15.00',
  frais_unite: 'EUR',
  quantite_detenue_avant: '0.1',
  quantite_detenue_apres: '0.1',
  pru_avant: '54030',
  pru_apres: '52030',
  effet_pru: '-2000',
  plus_value_realisee: null,
  cout_sortie: null,
  cout_total_apres: '5203.00',
};

function Harnais({ mouvement }) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuverte(true)}>
        Ouvrir
      </button>
      {ouverte && (
        <FeuilleMouvement
          actifs={[POSITION]}
          actifInitialId={POSITION.id}
          mouvement={mouvement}
          surFermeture={() => setOuverte(false)}
          surEnregistrement={() => {}}
        />
      )}
    </>
  );
}

async function ouvrir(mouvement) {
  const utilisateur = userEvent.setup();
  render(<Harnais mouvement={mouvement} />);
  await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }));
  return utilisateur;
}

beforeEach(() => {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });
  vi.spyOn(api, 'simulerModificationTransaction').mockResolvedValue(EFFET_CORRECTION);
  vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET_CORRECTION);
  vi.spyOn(api, 'modifierTransaction').mockResolvedValue({ ...ACHAT, prix_unitaire: '52000' });
  vi.spyOn(api, 'creerTransaction').mockResolvedValue(ACHAT);
  vi.spyOn(api, 'symboles').mockResolvedValue({ classes: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('feuille en correction', () => {
  it('s’intitule d’après ce qu’elle fait', async () => {
    await ouvrir(ACHAT);
    expect(screen.getByRole('heading', { name: 'Corriger le mouvement' })).toBeTruthy();
  });

  it('part des valeurs du mouvement plutôt que d’un formulaire vide', async () => {
    await ouvrir(ACHAT);

    expect(screen.getByLabelText(/^Quantité/).value).toBe('0.5');
    expect(screen.getByLabelText(/^Prix unitaire/).value).toBe('54000');
    expect(screen.getByLabelText(/^Frais/).value).toBe('15.00');
    expect(screen.getByLabelText(/^Date de l/).value).toBe('2026-05-27');
    expect(screen.getByRole('radio', { name: 'Achat' }).checked).toBe(true);
  });

  it('interdit de déplacer le mouvement vers une autre position', async () => {
    await ouvrir(ACHAT);

    // Un mouvement appartient à l'histoire d'une position. L'en détacher laisserait la
    // première avec un prix de revient calculé sur un mouvement qu'elle n'a plus.
    expect(screen.getByLabelText(/^Actif/).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Suivre un nouvel actif' })).toBeNull();
  });

  it('demande le récapitulatif à la route de correction', async () => {
    const utilisateur = await ouvrir(ACHAT);

    await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '52000');

    await waitFor(() => {
      expect(api.simulerModificationTransaction).toHaveBeenCalled();
    });
    expect(api.simulerTransaction).not.toHaveBeenCalled();

    const [, actifId, transactionId, corps] =
      api.simulerModificationTransaction.mock.calls.at(-1);
    expect(String(actifId)).toBe('1');
    expect(transactionId).toBe(12);
    expect(corps.prix_unitaire).toBe('52000');
  });

  it('annonce l’écart que la correction produit sur le prix de revient', async () => {
    const utilisateur = await ouvrir(ACHAT);

    await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '52000');

    // La position « avant » est celle d'aujourd'hui : l'écart annoncé est bien ce que la
    // correction change, et non ce qu'un mouvement ajouté aurait produit.
    await waitFor(() => {
      expect(screen.getByText('Nouveau prix de revient')).toBeTruthy();
    });
  });

  it('corrige au lieu de créer à la validation', async () => {
    const utilisateur = await ouvrir(ACHAT);

    await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '52000');

    await waitFor(() => {
      expect(screen.getByText('Nouveau prix de revient')).toBeTruthy();
    });

    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));

    await waitFor(() => {
      expect(api.modifierTransaction).toHaveBeenCalledTimes(1);
    });
    expect(api.creerTransaction).not.toHaveBeenCalled();
  });

  it('reprend l’unité des frais prélevés en nature', async () => {
    await ouvrir({
      ...ACHAT,
      frais: '10.80',
      frais_montant: '0.0002',
      frais_unite: 'BTC',
    });

    // Le champ porte le montant réellement prélevé, pas sa contre-valeur : c'est ce que
    // l'utilisateur avait saisi, donc ce qu'il doit relire.
    expect(screen.getByLabelText(/^Frais/).value).toBe('0.0002');
    expect(screen.getByLabelText(/Ces frais ont été prélevés en/).value).toBe('actif');
  });

  it('reste une création quand aucun mouvement n’est passé', async () => {
    const utilisateur = await ouvrir(null);

    expect(screen.getByRole('heading', { name: 'Nouveau mouvement' })).toBeTruthy();
    expect(screen.getByLabelText(/^Actif/).disabled).toBe(false);

    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.05');
    await waitFor(() => {
      expect(api.simulerTransaction).toHaveBeenCalled();
    });
    expect(api.simulerModificationTransaction).not.toHaveBeenCalled();
  });
});

describe('commandes de la frise', () => {
  it('propose de corriger avant de supprimer', () => {
    render(
      <FriseMouvements
        mouvements={[ACHAT]}
        classe="crypto"
        symbole="BTC"
        surCorrection={() => {}}
        surSuppression={() => {}}
      />
    );

    const commandes = screen.getAllByRole('button').map((bouton) => bouton.textContent);
    // L'ordre porte l'intention : le geste réparateur précède le geste destructeur.
    expect(commandes[0]).toContain('Corriger');
    expect(commandes[1]).toContain('Supprimer');
  });

  it('nomme le mouvement visé pour un lecteur d’écran', () => {
    render(
      <FriseMouvements
        mouvements={[ACHAT]}
        classe="crypto"
        symbole="BTC"
        surCorrection={() => {}}
      />
    );

    // « Corriger », lu seul dans une liste, ne dirait pas lequel des quatre mouvements.
    expect(screen.getByRole('button', { name: /Corriger achat du 27 mai 2026/ })).toBeTruthy();
  });

  it('remet le mouvement entier à l’appelant', async () => {
    const utilisateur = userEvent.setup();
    const surCorrection = vi.fn();

    render(
      <FriseMouvements
        mouvements={[ACHAT]}
        classe="crypto"
        symbole="BTC"
        surCorrection={surCorrection}
      />
    );

    await utilisateur.click(screen.getByRole('button', { name: /Corriger/ }));
    expect(surCorrection).toHaveBeenCalledWith(ACHAT);
  });

  it('n’affiche aucune commande quand l’écran n’en fournit pas', () => {
    render(<FriseMouvements mouvements={[ACHAT]} classe="crypto" symbole="BTC" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
