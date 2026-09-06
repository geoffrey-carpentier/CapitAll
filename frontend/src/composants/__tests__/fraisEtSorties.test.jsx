import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeuilleMouvement from '../FeuilleMouvement';
import FriseMouvements from '../FriseMouvements';
import * as contexte from '../../contexte/contexteAuthentification';
import { api } from '../../services/api';

// Les unités sont séparées de leur valeur par une espace insécable fine, et le
// récapitulatif entoure le rappel de parenthèses posées par le gabarit : le texte
// recherché est donc coupé entre plusieurs nœuds. La recherche porte sur le contenu
// normalisé du plus petit élément qui le porte entièrement.
function texteNormalise(attendu) {
  return (_, element) =>
    element?.textContent?.replace(/\s+/g, ' ').includes(attendu) &&
    ![...element.children].some((enfant) =>
      enfant.textContent?.replace(/\s+/g, ' ').includes(attendu)
    );
}

// Frais dans leur unité de prélèvement et sorties non marchandes, côté interface (D89).
//
// Deux choses se vérifient ici, et une seule est visible à l'œil. La première est que la
// saisie envoie au serveur la forme de frais que l'utilisateur a choisie, et elle seule.
// La seconde est qu'un transfert ne se lit nulle part comme une vente : ni dans son
// étiquette, ni dans un montant à zéro euro, ni dans une ligne de plus-value.

const POSITIONS = [
  {
    id: 1,
    type: 'crypto',
    symbole: 'ETH',
    nom: 'Ethereum',
    cours_eur: '2500.00',
    source_cours: 'coinbase',
    quantite_detenue: '1',
    pru: '2500',
  },
];

const EFFET_SORTIE = {
  sens: 'sortie_non_marchande',
  montant: '0.00',
  frais: '0',
  frais_montant: '0',
  frais_unite: 'EUR',
  quantite_detenue_avant: '1',
  quantite_detenue_apres: '0.998',
  pru_avant: '2500',
  pru_apres: '2500',
  effet_pru: '0',
  plus_value_realisee: null,
  cout_sortie: '5.00',
  cout_total_apres: '2495.00',
};

const EFFET_FRAIS_EN_NATURE = {
  sens: 'achat',
  montant: '995.00',
  frais: '5.00',
  frais_montant: '0.002',
  frais_unite: 'ETH',
  quantite_detenue_avant: '1',
  quantite_detenue_apres: '1.398',
  pru_avant: '2500',
  pru_apres: '2503.576...',
  effet_pru: '3.57',
  plus_value_realisee: null,
  cout_sortie: null,
  cout_total_apres: '3500.00',
};

function Harnais() {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuverte(true)}>
        Nouveau mouvement
      </button>
      {ouverte && (
        <FeuilleMouvement
          actifs={POSITIONS}
          surFermeture={() => setOuverte(false)}
          surEnregistrement={() => {}}
        />
      )}
    </>
  );
}

async function ouvrir() {
  const utilisateur = userEvent.setup();
  render(<Harnais />);
  await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));
  await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
  return utilisateur;
}

beforeEach(() => {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });
  vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET_SORTIE);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('saisie d’une sortie non marchande', () => {
  it('ne demande aucun prix', async () => {
    const utilisateur = await ouvrir();

    expect(screen.getByLabelText(/^Prix unitaire/)).toBeTruthy();

    await utilisateur.click(screen.getByRole('radio', { name: 'Sortie' }));

    // Le champ disparaît, il n'est pas seulement vidé : un prix saisi puis masqué
    // partirait quand même dans le corps de la requête.
    expect(screen.queryByLabelText(/^Prix unitaire/)).toBeNull();
  });

  it('annonce la valeur sortie et jamais une plus-value', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Sortie' }));
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.002');

    await waitFor(() => {
      expect(screen.getByText('Valeur sortie du portefeuille')).toBeTruthy();
    });

    expect(screen.queryByText('Plus-value réalisée')).toBeNull();
    expect(screen.queryByText("Montant de l'opération")).toBeNull();
  });

  it('n’envoie pas de prix au serveur', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Sortie' }));
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.002');

    await waitFor(() => {
      expect(api.simulerTransaction).toHaveBeenCalled();
    });

    const corps = api.simulerTransaction.mock.calls.at(-1)[2];
    expect(corps.sens).toBe('sortie_non_marchande');
    expect(corps.prix_unitaire).toBeUndefined();
  });

  it('propose de tout sortir plutôt que de tout vendre', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Sortie' }));

    expect(screen.getByRole('button', { name: 'Tout sortir' })).toBeTruthy();
  });
});

describe('saisie des frais dans leur unité de prélèvement', () => {
  it('n’affiche l’unité qu’une fois un montant de frais saisi', async () => {
    const utilisateur = await ouvrir();

    expect(screen.queryByLabelText(/Ces frais ont été prélevés en/)).toBeNull();

    await utilisateur.type(screen.getByLabelText(/^Frais/), '5');

    expect(screen.getByLabelText(/Ces frais ont été prélevés en/)).toBeTruthy();
  });

  it('envoie le montant et l’unité quand les frais sont prélevés dans l’actif', async () => {
    vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET_FRAIS_EN_NATURE);
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.398');
    await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '2500');
    await utilisateur.type(screen.getByLabelText(/^Frais/), '0.002');
    await utilisateur.selectOptions(
      screen.getByLabelText(/Ces frais ont été prélevés en/),
      'actif'
    );

    await waitFor(() => {
      const corps = api.simulerTransaction.mock.calls.at(-1)[2];
      expect(corps.frais_montant).toBe('0.002');
      expect(corps.frais_unite).toBe('ETH');
      // La forme courte et la forme longue s'excluent : le serveur refuse les deux
      // ensemble, et le corps ne doit donc jamais les porter toutes les deux.
      expect(corps.frais).toBeUndefined();
    });
  });

  it('demande la contre-valeur en euros pour un tiers actif', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.4');
    await utilisateur.type(screen.getByLabelText(/^Frais/), '0.01');
    await utilisateur.selectOptions(
      screen.getByLabelText(/Ces frais ont été prélevés en/),
      'tiers'
    );

    expect(screen.getByLabelText(/Actif des frais/)).toBeTruthy();
    expect(screen.getByLabelText(/Contre-valeur en euros/)).toBeTruthy();
  });

  it('rappelle la conversion dans le récapitulatif', async () => {
    vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET_FRAIS_EN_NATURE);
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.398');
    await utilisateur.type(screen.getByLabelText(/^Frais/), '0.002');
    await utilisateur.selectOptions(
      screen.getByLabelText(/Ces frais ont été prélevés en/),
      'actif'
    );

    // 0,002 ETH valent 5,00 euros : les deux chiffres sont annoncés avant validation,
    // le second n'étant pas déductible du premier sans connaître le prix retenu.
    await waitFor(() => {
      expect(screen.getByText(texteNormalise('0,002 ETH'))).toBeTruthy();
    });
  });
});

describe('précision de saisie rendue possible par le contrat numérique', () => {
  it('accepte un prix unitaire sous le centime', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Quantité/), '5000000');
    await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '0.0000123');

    // Le formulaire plafonnait encore à deux décimales : il refusait la valeur même que
    // le contrat numérique venait rendre stockable, et le refus ne venait pas du serveur.
    expect(screen.queryByText(/au plus 2 décimales/)).toBeNull();
    await waitFor(() => {
      expect(api.simulerTransaction).toHaveBeenCalled();
    });
    expect(api.simulerTransaction.mock.calls.at(-1)[2].prix_unitaire).toBe('0.0000123');
  });
});

describe('frise des mouvements', () => {
  const MOUVEMENTS = [
    {
      id: 1,
      sens: 'achat',
      quantite: '1',
      prix_unitaire: '2500',
      frais: '5.00',
      frais_montant: '0.002',
      frais_unite: 'ETH',
      montant: '2500.00',
      effet_pru: '2500',
      plus_value_realisee: null,
      cout_sortie: null,
      date_transaction: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 2,
      sens: 'sortie_non_marchande',
      quantite: '0.002',
      prix_unitaire: '0',
      frais: '0',
      frais_montant: '0',
      frais_unite: 'EUR',
      montant: '0.00',
      effet_pru: '0',
      plus_value_realisee: null,
      cout_sortie: '5.00',
      date_transaction: '2026-08-15T10:00:00.000Z',
    },
  ];

  it('étiquette une sortie sans jamais la nommer vente', () => {
    render(<FriseMouvements mouvements={MOUVEMENTS} classe="crypto" symbole="ETH" />);

    expect(screen.getByText('Sortie')).toBeTruthy();
    expect(screen.queryAllByText('Vente')).toHaveLength(0);
  });

  it('ne montre ni prix ni montant sur une sortie', () => {
    render(<FriseMouvements mouvements={[MOUVEMENTS[1]]} classe="crypto" symbole="ETH" />);

    // Ce sont ces deux lignes qui, valorisées à zéro, faisaient lire un transfert comme
    // une vente sans contrepartie.
    expect(screen.queryByText('Prix unitaire')).toBeNull();
    expect(screen.queryByText('Montant')).toBeNull();
    expect(screen.getByText('Valeur sortie du portefeuille')).toBeTruthy();
    expect(screen.queryByText('Plus-value réalisée')).toBeNull();
  });

  it('rappelle le montant réellement prélevé derrière sa contre-valeur', () => {
    render(<FriseMouvements mouvements={[MOUVEMENTS[0]]} classe="crypto" symbole="ETH" />);

    expect(screen.getByText(texteNormalise('(0,002 ETH)'))).toBeTruthy();
  });
});
