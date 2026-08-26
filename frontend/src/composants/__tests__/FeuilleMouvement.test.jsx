import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeuilleMouvement from '../FeuilleMouvement';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// La feuille de saisie est testée sur ce qui se casse en silence : le récapitulatif, qui
// doit venir du serveur et non d'un calcul refait ici, le bornement de la vente, le
// blocage de la validation, et le comportement de dialogue modal.
//
// Les réponses simulées reproduisent la forme exacte de celles du serveur, chaînes
// comprises : une valeur inventée validerait un affichage faux.

const POSITIONS = [
  {
    id: 1,
    type: 'crypto',
    symbole: 'BTC',
    nom: 'Bitcoin',
    cours_eur: '60801.20',
    source_cours: 'coinbase',
    quantite_detenue: '0.6',
    pru: '56656.25',
  },
  {
    id: 4,
    type: 'metal',
    symbole: 'XAU',
    nom: 'Or',
    cours_eur: '88.45',
    source_cours: 'gold-api',
    quantite_detenue: '120',
    pru: '74.10',
  },
];

const EFFET_ACHAT = {
  sens: 'achat',
  montant: '11780.00',
  frais: '2.40',
  quantite_detenue_avant: '0.6',
  quantite_detenue_apres: '0.8',
  pru_avant: '56656.25',
  pru_apres: '57107.4',
  effet_pru: '451.15',
  plus_value_realisee: null,
  cout_total_apres: '45685.92',
};

const EFFET_VENTE = {
  sens: 'vente',
  montant: '12700.00',
  frais: '0',
  quantite_detenue_avant: '0.6',
  quantite_detenue_apres: '0.4',
  pru_avant: '56656.25',
  pru_apres: '56656.25',
  effet_pru: '0',
  plus_value_realisee: '1368.75',
  cout_total_apres: '22662.50',
};

// La feuille est montée par un déclencheur, comme dans l'application : c'est la seule
// façon de vérifier que le focus lui revient à la fermeture.
function Harnais({ actifs = POSITIONS, surEnregistrement = () => {} }) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuverte(true)}>
        Nouveau mouvement
      </button>
      {ouverte && (
        <FeuilleMouvement
          actifs={actifs}
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
  await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));
  return utilisateur;
}

// Saisie complète d'un achat sur le bitcoin, jusqu'à l'apparition du récapitulatif.
async function saisirAchat(utilisateur, { quantite = '0.2', prix = '58900', frais = '2.40' } = {}) {
  await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
  await utilisateur.type(screen.getByLabelText(/^Quantité/), quantite);
  await utilisateur.clear(screen.getByLabelText(/^Prix unitaire/));
  await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), prix);
  await utilisateur.type(screen.getByLabelText(/^Frais/), frais);
}

beforeEach(() => {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });
  vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET_ACHAT);
  vi.spyOn(api, 'creerTransaction').mockResolvedValue({
    id: 42,
    actif_id: 1,
    sens: 'achat',
    quantite: '0.20000000',
    prix_unitaire: '58900.00',
    frais: '2.40',
    date_transaction: '2026-08-25T10:00:00.000Z',
    note: null,
  });
  vi.spyOn(api, 'creerActif').mockResolvedValue({
    id: 9,
    utilisateur_id: 2,
    type: 'crypto',
    symbole: 'SOL',
    nom: 'Solana',
    date_ajout: '2026-08-25T10:00:00.000Z',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('forme et accessibilité', () => {
  it('est un dialogue modal intitulé', async () => {
    await ouvrir();

    const dialogue = screen.getByRole('dialog');
    expect(dialogue.getAttribute('aria-modal')).toBe('true');
    expect(within(dialogue).getByRole('heading', { name: 'Nouveau mouvement' })).toBeTruthy();
  });

  it('place le focus dans la feuille à son ouverture', async () => {
    await ouvrir();

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('se ferme par Échap et rend le focus à son déclencheur', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Nouveau mouvement' })
    );
  });

  it('se ferme par le bouton de fermeture', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Le sens est un groupe de boutons radio et non une paire de boutons : les flèches du
  // clavier doivent passer d'une option à l'autre.
  it('présente le sens en boutons radio, achat par défaut', async () => {
    const utilisateur = await ouvrir();

    const achat = screen.getByRole('radio', { name: 'Achat' });
    const vente = screen.getByRole('radio', { name: 'Vente' });
    expect(achat.checked).toBe(true);

    achat.focus();
    await utilisateur.keyboard('{ArrowRight}');
    expect(vente.checked).toBe(true);
  });

  it('annonce les recalculs du récapitulatif sans interrompre la saisie', async () => {
    await ouvrir();

    const region = screen.getByRole('region', { name: /Effet de ce mouvement/ });
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('déclare les champs numériques en saisie décimale', async () => {
    await ouvrir();

    expect(screen.getByLabelText(/^Quantité/).getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByLabelText(/^Prix unitaire/).getAttribute('inputmode')).toBe('decimal');
  });
});

describe('récapitulatif', () => {
  it("demande l'effet du mouvement au serveur plutôt que de le calculer", async () => {
    const utilisateur = await ouvrir();
    await saisirAchat(utilisateur);

    await waitFor(() =>
      expect(api.simulerTransaction).toHaveBeenCalledWith(
        'jeton-de-test',
        '1',
        expect.objectContaining({
          sens: 'achat',
          quantite: '0.2',
          prix_unitaire: '58900',
          frais: '2.40',
        })
      )
    );
  });

  it('affiche le nouveau prix de revient et son déplacement', async () => {
    const utilisateur = await ouvrir();
    await saisirAchat(utilisateur);

    expect(await screen.findByText(/57\s?107,4/)).toBeTruthy();
    expect(screen.getByText(/\+451,15/)).toBeTruthy();
    expect(screen.getByText(/11\s?780/)).toBeTruthy();
  });

  it('nomme la plus-value dégagée par une vente et dit le prix de revient inchangé', async () => {
    api.simulerTransaction.mockResolvedValue(EFFET_VENTE);
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Vente' }));
    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.2');

    expect(await screen.findByText('Plus-value réalisée')).toBeTruthy();
    expect(screen.getByText('inchangé')).toBeTruthy();
  });

  // Le prix unitaire est pré-rempli au cours du jour, avec une mention explicite : sans
  // elle, la valeur proposée se lirait comme le prix de l'opération saisie.
  it('propose le cours du jour et le dit', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');

    expect(screen.getByLabelText(/^Prix unitaire/).value).toBe('60801.20');
    expect(screen.getByText(/Cours du jour/)).toBeTruthy();
  });

  it("explique l'absence de récapitulatif tant que la saisie est incomplète", async () => {
    await ouvrir();

    expect(screen.getByText(/pour voir l'effet de ce mouvement/)).toBeTruthy();
    expect(api.simulerTransaction).not.toHaveBeenCalled();
  });

  it('signale un récapitulatif refusé par le serveur sans inventer de chiffres', async () => {
    api.simulerTransaction.mockRejectedValue(
      new ErreurApi('Quantité insuffisante : vous détenez 0.6 sur cet actif.', 400)
    );
    const utilisateur = await ouvrir();
    await saisirAchat(utilisateur);

    expect(await screen.findByText(/ne peut pas être calculé/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
  });
});

describe('validation', () => {
  it("bloque l'enregistrement tant que l'effet du mouvement n'est pas connu", async () => {
    await ouvrir();

    expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
  });

  it('refuse une quantité qui n\'est pas un nombre', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), 'beaucoup');
    await utilisateur.tab();

    expect(screen.getByText(/La quantité doit être un nombre positif/)).toBeTruthy();
    expect(api.simulerTransaction).not.toHaveBeenCalled();
  });

  it('refuse une quantité nulle', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0');
    await utilisateur.tab();

    expect(screen.getByText('La quantité doit être supérieure à zéro.')).toBeTruthy();
  });

  it("interdit une date postérieure à aujourd'hui", async () => {
    const utilisateur = await ouvrir();

    const date = screen.getByLabelText(/^Date/);
    // Le champ est borné au jour même, et pré-rempli à cette date.
    expect(date.getAttribute('max')).toBe(date.value);

    await utilisateur.clear(date);
    await utilisateur.type(date, '2030-01-01');
    await utilisateur.tab();

    expect(screen.getByText(/ne peut pas être postérieure/)).toBeTruthy();
  });

  // La règle appartient au serveur ; l'interface l'annonce avant l'envoi, avec la
  // quantité que le serveur a rendue.
  it('borne la vente à la quantité détenue', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Vente' }));
    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.9');

    expect(screen.getByText(/Vous détenez 0,6 BTC/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
    expect(api.simulerTransaction).not.toHaveBeenCalled();
  });

  it('remplit la quantité exacte détenue par le raccourci de vente totale', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.click(screen.getByRole('radio', { name: 'Vente' }));
    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.click(screen.getByRole('button', { name: 'Tout vendre' }));

    expect(screen.getByLabelText(/^Quantité/).value).toBe('0.6');
  });

  it('accepte une quantité saisie avec une virgule', async () => {
    const utilisateur = await ouvrir();

    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0,2');

    await waitFor(() =>
      expect(api.simulerTransaction).toHaveBeenCalledWith(
        'jeton-de-test',
        '1',
        expect.objectContaining({ quantite: '0.2' })
      )
    );
  });
});

describe('enregistrement', () => {
  it('envoie le mouvement puis rend la main à l\'écran d\'origine', async () => {
    const surEnregistrement = vi.fn();
    const utilisateur = await ouvrir({ surEnregistrement });
    await saisirAchat(utilisateur);
    await screen.findByText(/57\s?107,4/);

    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(api.creerTransaction).toHaveBeenCalledWith(
      'jeton-de-test',
      '1',
      expect.objectContaining({ sens: 'achat', quantite: '0.2', prix_unitaire: '58900' })
    );
    await waitFor(() => expect(surEnregistrement).toHaveBeenCalled());
    // L'espace qui précède le symbole est une espace insécable, posée par le module de
    // formatage : le motif ne présume pas de sa nature.
    expect(surEnregistrement.mock.calls[0][0].resume).toMatch(/Achat de 0,2\sBTC enregistré/);
  });

  // Les messages de validation du serveur se posent sur les champs concernés, jamais en
  // bloc au-dessus du formulaire.
  it('replace les erreurs de validation du serveur sur leurs champs', async () => {
    api.creerTransaction.mockRejectedValue(
      new ErreurApi('Données invalides.', 400, [
        { champ: 'quantite', message: 'La valeur doit être strictement positive.' },
      ])
    );
    const utilisateur = await ouvrir();
    await saisirAchat(utilisateur);
    await screen.findByText(/57\s?107,4/);

    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('La valeur doit être strictement positive.')
    ).toBeTruthy();
  });

  it('affiche le message du serveur lorsqu\'aucun champ n\'est nommé', async () => {
    api.creerTransaction.mockRejectedValue(
      new ErreurApi('Quantité insuffisante : vous détenez 0.6 sur cet actif.', 400)
    );
    const utilisateur = await ouvrir();
    await saisirAchat(utilisateur);
    await screen.findByText(/57\s?107,4/);

    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/Quantité insuffisante/)).toBeTruthy();
  });

  it('reste ouverte et ne prévient pas l\'écran d\'origine quand l\'envoi échoue', async () => {
    const surEnregistrement = vi.fn();
    api.creerTransaction.mockRejectedValue(new ErreurApi('Le serveur est injoignable.', 0));
    const utilisateur = await ouvrir({ surEnregistrement });
    await saisirAchat(utilisateur);
    await screen.findByText(/57\s?107,4/);

    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/injoignable/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(surEnregistrement).not.toHaveBeenCalled();
  });
});

describe('portefeuille vide', () => {
  // Sans création possible ici, un compte neuf ne pourrait enregistrer aucun mouvement :
  // le sélecteur serait vide et le parcours de premier lancement s'arrêterait là.
  it('ouvre directement sur la création lorsque aucun actif n\'est suivi', async () => {
    await ouvrir({ actifs: [] });

    expect(screen.queryByLabelText(/^Actif/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ajouter cet actif' })).toBeTruthy();
  });

  it('crée l\'actif puis le sélectionne pour la saisie', async () => {
    const utilisateur = await ouvrir({ actifs: [] });

    await utilisateur.type(screen.getByLabelText(/^Symbole/), 'SOL');
    await utilisateur.type(screen.getByLabelText(/^Nom/), 'Solana');
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter cet actif' }));

    expect(api.creerActif).toHaveBeenCalledWith('jeton-de-test', {
      type: 'crypto',
      symbole: 'SOL',
      nom: 'Solana',
    });
    expect((await screen.findByLabelText(/^Actif/)).value).toBe('9');
  });

  it('signale un symbole déjà suivi sur le champ qui le porte', async () => {
    api.creerActif.mockRejectedValue(new ErreurApi('Le symbole SOL est déjà suivi.', 409));
    const utilisateur = await ouvrir({ actifs: [] });

    await utilisateur.type(screen.getByLabelText(/^Symbole/), 'SOL');
    await utilisateur.type(screen.getByLabelText(/^Nom/), 'Solana');
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter cet actif' }));

    expect(await screen.findByText(/déjà suivi/)).toBeTruthy();
  });
});
