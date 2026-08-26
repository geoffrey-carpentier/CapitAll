import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Seuils from '../Seuils';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// L'écran est testé sur ses règles de comportement : les deux groupes, l'écart restant
// affiché en toutes lettres et non seulement par la barre, le retrait, et l'ouverture de
// la feuille de création. Les valeurs dérivées (valeur_observee, ecart_pourcentage)
// sont celles que le serveur rend déjà : l'écran ne les recalcule pas (D69), le jeu
// d'essai reproduit donc la forme exacte de la réponse.

const SEUILS = [
  {
    id: 1,
    utilisateur_id: 2,
    actif_id: 1,
    type_cible: 'actif',
    sens_seuil: 'au_dessus',
    valeur_seuil: '65000.00',
    statut: 'active',
    date_creation: '2026-08-01T10:00:00.000Z',
    date_declenchement: null,
    symbole: 'BTC',
    nom_actif: 'Bitcoin',
    valeur_observee: '61240.00',
    ecart_pourcentage: '6.14',
  },
  {
    id: 2,
    utilisateur_id: 2,
    actif_id: null,
    type_cible: 'capital_total',
    sens_seuil: 'au_dessus',
    valeur_seuil: '45000.00',
    statut: 'declenchee',
    date_creation: '2026-07-01T10:00:00.000Z',
    date_declenchement: '2026-08-23T15:34:10.000Z',
    symbole: null,
    nom_actif: null,
    valeur_observee: '58566.64',
    ecart_pourcentage: '0',
  },
  {
    id: 3,
    utilisateur_id: 2,
    actif_id: 4,
    type_cible: 'actif',
    sens_seuil: 'en_dessous',
    valeur_seuil: '1.40',
    statut: 'desactivee',
    date_creation: '2026-06-01T10:00:00.000Z',
    date_declenchement: null,
    symbole: 'XAU',
    nom_actif: 'Or',
    valeur_observee: null,
    ecart_pourcentage: null,
  },
  // Seuil en cours dont le cours de la cible est indisponible : la barre l'annonce
  // par une mention explicite plutôt qu'une progression à zéro, qui mentirait. Un
  // actif distinct de l'or, pour ne pas interférer avec le seuil désactivé ci-dessus.
  {
    id: 4,
    utilisateur_id: 2,
    actif_id: 5,
    type_cible: 'actif',
    sens_seuil: 'au_dessus',
    valeur_seuil: '200.00',
    statut: 'active',
    date_creation: '2026-08-10T10:00:00.000Z',
    date_declenchement: null,
    symbole: 'AAPL',
    nom_actif: 'Apple',
    valeur_observee: null,
    ecart_pourcentage: null,
  },
];

const PORTEFEUILLE = {
  valeur_totale: '58566.64',
  actifs: [
    { id: 1, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin', cours_eur: '61240.00' },
    { id: 4, type: 'metal', symbole: 'XAU', nom: 'Or', cours_eur: null },
    { id: 5, type: 'action', symbole: 'AAPL', nom: 'Apple', cours_eur: null },
  ],
  taux_affichage: {
    eur_vers_usd: '1.1699',
    usd_vers_eur: '0.85477',
    horodatage: '2026-08-26T00:00:00.000Z',
  },
};

let adresse = null;
function Sonde() {
  adresse = useLocation();
  return null;
}

function rendre(entree = '/seuils') {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });

  return render(
    <MemoryRouter initialEntries={[entree]}>
      <Sonde />
      <Seuils />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.spyOn(api, 'alertes').mockResolvedValue(SEUILS);
  vi.spyOn(api, 'portefeuille').mockResolvedValue(PORTEFEUILLE);
  // Sans ce nettoyage, la préférence de masquage écrite par un test antérieur
  // survivrait au montage suivant : sessionStorage n'est pas réinitialisé entre les
  // tests d'un même fichier, seulement entre les fichiers.
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('composition', () => {
  it('sépare les seuils franchis des seuils en cours, dans cet ordre', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    const titres = screen.getAllByRole('heading', { level: 2 }).map((titre) => titre.textContent);
    expect(titres).toEqual(['Franchis', 'En cours']);
  });

  it('exclut les seuils désactivés de la liste', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    expect(screen.queryByText(/Or/)).toBeNull();
  });

  // Le pourcentage restant est toujours écrit en toutes lettres à côté de la barre :
  // ce n'est pas elle qui porte seule l'information.
  it("écrit l'écart restant en toutes lettres à côté de la barre", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    expect(screen.getByText(/reste/)).toBeTruthy();
    expect(screen.getByText(/6,1/)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('porte la date de franchissement sur un seuil franchi', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    expect(screen.getByText(/Franchi le/)).toBeTruthy();
  });

  it('affiche le portefeuille vide sans seuil comme un état à combler', async () => {
    api.alertes.mockResolvedValue([]);
    rendre();

    expect(await screen.findByText('Aucun seuil')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer un seuil' })).toBeTruthy();
  });
});

describe('cours indisponible sur la cible', () => {
  it("affiche la mention de progression indisponible plutôt qu'une barre à zéro", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    expect(screen.getByText(/Cours indisponible : la progression/)).toBeTruthy();
  });

  it("n'affiche pas d'écart restant quand la valeur observée est nulle", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    const carte = screen.getAllByText(/Apple/)[0].closest('li');
    expect(within(carte).queryByText(/reste/)).toBeNull();
  });
});

describe('préférences d’affichage globales (D83)', () => {
  it('convertit les montants du seuil et de la barre sans nouvelle requête', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });
    const appelsAvant = api.alertes.mock.calls.length + api.portefeuille.mock.calls.length;

    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));

    // 65 000 x 1,1699 = 76 043,5 : le seuil Bitcoin, converti à l'affichage. La valeur
    // apparaît deux fois par ligne, dans l'intitulé et dans les repères de la barre.
    expect((await screen.findAllByText(/76.043,5/)).length).toBeGreaterThan(0);
    expect(api.alertes.mock.calls.length + api.portefeuille.mock.calls.length).toBe(appelsAvant);
  });

  it("remplace les montants par des points au masquage, sans toucher à l'écart en pourcentage", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    await utilisateur.click(screen.getByLabelText('Masquer les montants'));

    expect(screen.getAllByLabelText('Montant masqué').length).toBeGreaterThan(0);
    expect(screen.queryByText(/65.000/)).toBeNull();
    // Un pourcentage n'est jamais masqué, au même titre que les autres écrans.
    expect(screen.getByText(/reste/)).toBeTruthy();
    expect(screen.getByText(/6,1/)).toBeTruthy();
  });

  it('masque également le montant du seuil dans le dialogue de retrait', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    await utilisateur.click(screen.getByLabelText('Masquer les montants'));
    await utilisateur.click(screen.getAllByRole('button', { name: /Retirer/ })[0]);

    const dialogue = screen.getByRole('dialog');
    expect(within(dialogue).getByLabelText('Montant masqué')).toBeTruthy();
  });
});

describe('retrait', () => {
  it('demande confirmation avant de retirer un seuil', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    await utilisateur.click(screen.getAllByRole('button', { name: /Retirer/ })[0]);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/ne surveillera plus rien/)).toBeTruthy();
  });

  it('retire le seuil confirmé et recharge la liste', async () => {
    const utilisateur = userEvent.setup();
    vi.spyOn(api, 'desactiverAlerte').mockResolvedValue({ id: 2, statut: 'desactivee' });
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    // Les seuils franchis sont listés en premier : c'est celui-là que cible le premier
    // bouton de retrait rencontré dans le document.
    await utilisateur.click(screen.getAllByRole('button', { name: /Retirer/ })[0]);
    await utilisateur.click(screen.getByRole('button', { name: 'Retirer le seuil' }));

    expect(api.desactiverAlerte).toHaveBeenCalledWith('jeton-de-test', 2);
    await waitFor(() => expect(api.alertes).toHaveBeenCalledTimes(2));
  });
});

describe('saisie d’un seuil', () => {
  it("ouvre la feuille par-dessus la liste et l'inscrit dans l'adresse", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: '+ Seuil' }));

    expect(screen.getByRole('dialog', { name: 'Nouveau seuil' })).toBeTruthy();
    expect(adresse.search).toContain('seuil=nouveau');
  });

  it('recharge les seuils et confirme après une création', async () => {
    const utilisateur = userEvent.setup();
    vi.spyOn(api, 'creerAlerte').mockResolvedValue({
      id: 9,
      utilisateur_id: 2,
      actif_id: null,
      type_cible: 'capital_total',
      sens_seuil: 'au_dessus',
      valeur_seuil: '80000.00',
      statut: 'active',
      date_creation: '2026-08-26T10:00:00.000Z',
      date_declenchement: null,
    });

    rendre();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });
    const chargements = api.alertes.mock.calls.length;

    await utilisateur.click(screen.getByRole('button', { name: '+ Seuil' }));
    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '80000');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(await screen.findByText(/Seuil créé pour Patrimoine total/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(api.alertes.mock.calls.length).toBeGreaterThan(chargements));
  });
});

describe('erreurs et chargement', () => {
  it("affiche l'état de chargement puis la liste", async () => {
    rendre();
    expect(screen.getByRole('status')).toBeTruthy();
    await screen.findByRole('heading', { name: 'Seuils', level: 1 });
  });

  it('signale une session expirée sans dévoiler les seuils', async () => {
    api.alertes.mockRejectedValue(new ErreurApi('Jeton expiré.', 401));
    rendre();

    expect(await screen.findByText('Session expirée')).toBeTruthy();
  });
});
