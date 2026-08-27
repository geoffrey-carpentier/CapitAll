import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeuilleSeuil from '../FeuilleSeuil';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// La feuille de création est testée sur ce qui se casse en silence : le calcul exact
// des décalages rapides, le blocage de la validation, et le comportement de dialogue
// modal déjà couvert pour la feuille de mouvement, ici vérifié une fois pour la cible.

const ACTIFS = [
  { id: 1, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin', cours_eur: '61240.00' },
  { id: 4, type: 'metal', symbole: 'XAU', nom: 'Or', cours_eur: null },
];

function Harnais({
  actifs = ACTIFS,
  capitalTotal = '58566.64',
  cibleInitiale,
  permettrePatrimoineTotal,
  surEnregistrement = () => {},
}) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuverte(true)}>
        Nouveau seuil
      </button>
      {ouverte && (
        <FeuilleSeuil
          actifs={actifs}
          capitalTotal={capitalTotal}
          cibleInitiale={cibleInitiale}
          permettrePatrimoineTotal={permettrePatrimoineTotal}
          surFermeture={() => setOuverte(false)}
          surEnregistrement={surEnregistrement}
        />
      )}
    </>
  );
}

async function ouvrir(proprietes) {
  const utilisateur = userEvent.setup();
  render(<Harnais {...proprietes} />);
  await utilisateur.click(screen.getByRole('button', { name: 'Nouveau seuil' }));
  return utilisateur;
}

beforeEach(() => {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });
  vi.spyOn(api, 'creerAlerte').mockResolvedValue({
    id: 9,
    utilisateur_id: 2,
    actif_id: 1,
    type_cible: 'actif',
    sens_seuil: 'au_dessus',
    valeur_seuil: '67364.00',
    statut: 'active',
    date_creation: '2026-08-26T10:00:00.000Z',
    date_declenchement: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('forme et accessibilité', () => {
  it('est un dialogue modal', async () => {
    await ouvrir();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('se ferme par Échap et rend le focus à son déclencheur', async () => {
    const utilisateur = await ouvrir();
    await utilisateur.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nouveau seuil' }));
  });

  it('présente le sens en boutons radio', async () => {
    await ouvrir();

    const auDessus = screen.getByRole('radio', { name: 'Au-dessus de' });
    const enDessous = screen.getByRole('radio', { name: 'En dessous de' });
    expect(auDessus.checked).toBe(true);
    expect(enDessous.checked).toBe(false);
  });

  it('propose le patrimoine total par défaut', async () => {
    await ouvrir();
    expect(screen.getByLabelText('Cible').value).toBe('capital_total');
    expect(screen.getByText(/58.566,64/)).toBeTruthy();
  });
});

describe('cible initiale (E4, ouverture depuis l’écran de détail)', () => {
  it('se règle sur l’actif désigné par cibleInitiale', async () => {
    await ouvrir({ cibleInitiale: 1 });

    expect(screen.getByLabelText('Cible').value).toBe('actif:1');
    // Le cours de l'actif présélectionné est repris comme valeur actuelle.
    expect(screen.getByText(/61.240/)).toBeTruthy();
  });

  it('retombe sur le patrimoine total quand la cible ne correspond à aucun actif connu', async () => {
    await ouvrir({ cibleInitiale: 999 });

    expect(screen.getByLabelText('Cible').value).toBe('capital_total');
  });

  it('retire le patrimoine total du sélecteur quand permettrePatrimoineTotal est faux', async () => {
    await ouvrir({ cibleInitiale: 1, permettrePatrimoineTotal: false });

    const options = within(screen.getByLabelText('Cible')).getAllByRole('option');
    expect(options.map((option) => option.value)).not.toContain('capital_total');
    expect(screen.getByLabelText('Cible').value).toBe('actif:1');
  });

  // Cas défensif : si la cible ne correspondait à aucun actif, la feuille ne doit pas
  // se rabattre sur une option absente du sélecteur.
  it('se rabat sur le premier actif quand la cible est invalide et le patrimoine total exclu', async () => {
    await ouvrir({ cibleInitiale: 999, permettrePatrimoineTotal: false });

    expect(screen.getByLabelText('Cible').value).toBe('actif:1');
  });
});

describe('cible', () => {
  it('affiche le cours actuel quand un actif est choisi', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText('Cible'), 'actif:1');

    expect(screen.getByText(/61.240/)).toBeTruthy();
  });

  it('signale un cours indisponible et désactive les décalages', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText('Cible'), 'actif:4');

    expect(screen.getByText(/Aucun cours disponible pour XAU/)).toBeTruthy();
    screen.getAllByRole('button', { name: /%$/ }).forEach((bouton) => {
      expect(bouton.disabled).toBe(true);
    });
  });
});

describe('décalages rapides', () => {
  it('calcule le seuil à +10 % exactement, sans artefact décimal', async () => {
    const utilisateur = await ouvrir();
    await utilisateur.selectOptions(screen.getByLabelText('Cible'), 'actif:1');

    await utilisateur.click(screen.getByRole('button', { name: '+10 %' }));

    expect(screen.getByLabelText(/^Seuil de déclenchement/).value).toBe('67364.00');
  });

  it('calcule le seuil à -10 % exactement', async () => {
    const utilisateur = await ouvrir();
    await utilisateur.selectOptions(screen.getByLabelText('Cible'), 'actif:1');

    await utilisateur.click(screen.getByRole('button', { name: '-10 %' }));

    expect(screen.getByLabelText(/^Seuil de déclenchement/).value).toBe('55116.00');
  });
});

describe('validation', () => {
  it('refuse un seuil nul ou négatif', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '0');
    await utilisateur.tab();

    expect(screen.getByText('Le seuil doit être strictement positif.')).toBeTruthy();
    expect(api.creerAlerte).not.toHaveBeenCalled();
  });

  it("bloque la création tant que rien n'est saisi", async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(screen.getByText('Le seuil est obligatoire.')).toBeTruthy();
    expect(api.creerAlerte).not.toHaveBeenCalled();
  });
});

describe('création', () => {
  it('envoie la cible, le sens et le seuil, puis prévient l’écran d’origine', async () => {
    const surEnregistrement = vi.fn();
    const utilisateur = await ouvrir({ surEnregistrement });

    await utilisateur.selectOptions(screen.getByLabelText('Cible'), 'actif:1');
    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '67364');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(api.creerAlerte).toHaveBeenCalledWith('jeton-de-test', {
      type_cible: 'actif',
      sens_seuil: 'au_dessus',
      valeur_seuil: '67364',
      actif_id: 1,
    });
    await waitFor(() => expect(surEnregistrement).toHaveBeenCalled());
    expect(surEnregistrement.mock.calls[0][0].resume).toMatch(/Bitcoin/);
  });

  it('envoie une alerte sur le capital total sans identifiant d’actif', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '45000');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(api.creerAlerte).toHaveBeenCalledWith(
      'jeton-de-test',
      expect.not.objectContaining({ actif_id: expect.anything() })
    );
    expect(api.creerAlerte).toHaveBeenCalledWith(
      'jeton-de-test',
      expect.objectContaining({ type_cible: 'capital_total' })
    );
  });

  it('replace une erreur de validation du serveur sur son champ', async () => {
    api.creerAlerte.mockRejectedValue(
      new ErreurApi('Données invalides.', 400, [
        { champ: 'valeur_seuil', message: 'Le seuil doit être strictement positif.' },
      ])
    );
    const utilisateur = await ouvrir();

    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '1');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(
      await screen.findByText('Le seuil doit être strictement positif.')
    ).toBeTruthy();
  });
});
