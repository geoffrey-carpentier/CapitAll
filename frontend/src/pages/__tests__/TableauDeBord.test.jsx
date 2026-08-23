import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TableauDeBord from '../TableauDeBord';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// L'écran est testé sur ses règles de comportement et ses états, pas sur son rendu
// nominal seul : ce sont les règles qui portent les décisions de conception, et ce sont
// elles qui se cassent silencieusement.

const PORTEFEUILLE = {
  valeur_totale: '12480.65',
  cout_total: '10000.00',
  plus_value_latente: '2480.65',
  plus_value_realisee: '150.00',
  pourcentage_variation: '24.81',
  repartition: [
    { type: 'crypto', valeur: '7480.65', pourcentage: '59.94' },
    { type: 'action', valeur: '5000.00', pourcentage: '40.06' },
  ],
  actifs: [
    { id: 1, type: 'crypto', symbole: 'BTC', nom: 'Bitcoin', source_cours: 'fournisseur' },
    { id: 2, type: 'action', symbole: 'AAPL', nom: 'Apple', source_cours: 'fournisseur' },
  ],
  cours_indisponibles: [],
  taux_affichage: { eur_vers_usd: '1.1364', usd_vers_eur: '0.88', horodatage: '2026-08-11T08:00:00Z' },
  alertes_declenchees: [],
};

const HISTORIQUE = {
  points: [
    { date_snapshot: '2026-08-09', valeur_totale_eur: '12000.00' },
    { date_snapshot: '2026-08-10', valeur_totale_eur: '12200.00' },
    { date_snapshot: '2026-08-11', valeur_totale_eur: '12480.65' },
  ],
  performances: { jour: '2.30', semaine: '4.01', mois: '9.12', annee: '31.40', origine: '40.00' },
};

function rendre(etat = {}) {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });

  return render(
    <MemoryRouter initialEntries={[{ pathname: '/tableau-de-bord', state: etat }]}>
      <TableauDeBord />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.spyOn(api, 'portefeuille').mockResolvedValue(PORTEFEUILLE);
  vi.spyOn(api, 'historique').mockResolvedValue(HISTORIQUE);
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('règles de comportement', () => {
  it('affiche le patrimoine, sa variation absolue et sa variation relative', async () => {
    rendre();

    expect(await screen.findByText(/12.480,65/)).toBeTruthy();
    // La variation absolue paraît deux fois, et c'est voulu : en tête, comme variation
    // du patrimoine depuis l'origine, et plus bas, nommée « plus-value latente » parmi
    // les chiffres de contexte. Ce sont deux lectures du même montant.
    expect(screen.getAllByLabelText(/en hausse de 2.480,65/)).toHaveLength(2);
    // Une variation relative s'écrit à une décimale : 24,81 s'affiche « +24,8 % ».
    expect(screen.getByLabelText(/en hausse de 24,8 /)).toBeTruthy();
  });

  // Le taux accompagne la réponse : basculer ne doit déclencher aucune requête.
  it('convertit en dollars sans nouvelle requête', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    const appelsAvant = api.portefeuille.mock.calls.length + api.historique.mock.calls.length;
    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));

    // 12480,65 x 1,1364 = 14183,0106, arrondi au centime.
    expect(await screen.findByText(/14.183,01/)).toBeTruthy();
    expect(api.portefeuille.mock.calls.length + api.historique.mock.calls.length).toBe(appelsAvant);
  });

  it('conserve le choix de devise dans la session', async () => {
    const utilisateur = userEvent.setup();
    const { unmount } = rendre();
    await screen.findByText(/12.480,65/);

    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));
    await screen.findByText(/14.183,01/);
    unmount();

    rendre();
    expect(await screen.findByText(/14.183,01/)).toBeTruthy();
  });

  // Le masquage porte sur les montants, pas sur la structure : la composition reste
  // lisible, ce qui évite l'effet de page vide.
  it('remplace tous les montants par des points au masquage', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    await utilisateur.click(screen.getByLabelText('Masquer les montants'));

    await waitFor(() => expect(screen.queryByText(/12.480,65/)).toBeNull());
    expect(screen.getAllByLabelText('Montant masqué').length).toBeGreaterThan(0);
    // Un interrupteur d'affichage annonce son état, il ne se contente pas de changer.
    expect(screen.getByLabelText('Afficher les montants').getAttribute('aria-pressed')).toBe('true');
  });

  it('masque la répartition tant qu\'il n\'y a qu\'une position', async () => {
    api.portefeuille.mockResolvedValue({
      ...PORTEFEUILLE,
      actifs: [PORTEFEUILLE.actifs[0]],
      repartition: [{ type: 'crypto', valeur: '12480.65', pourcentage: '100.00' }],
    });
    rendre();

    await screen.findByText(/12.480,65/);
    expect(screen.queryByText('Répartition')).toBeNull();
  });

  // Une courbe à un point ne trace rien et laisse croire à une perte de données.
  it('remplace la courbe par un message sous deux points de mesure', async () => {
    api.historique.mockResolvedValue({
      points: [{ date_snapshot: '2026-08-11', valeur_totale_eur: '12480.65' }],
      performances: { jour: null, semaine: null, mois: null, annee: null, origine: null },
    });
    rendre();

    expect(await screen.findByText(/après quelques jours de suivi/)).toBeTruthy();
  });

  it('signale un repli sur le dernier cours connu sans masquer les valorisations', async () => {
    api.portefeuille.mockResolvedValue({
      ...PORTEFEUILLE,
      actifs: [
        { ...PORTEFEUILLE.actifs[0], source_cours: 'repli', horodatage_cours: '2026-08-09T10:00:00Z' },
        PORTEFEUILLE.actifs[1],
      ],
    });
    rendre();

    const bandeau = await screen.findByText(/dernier cours connu/);
    expect(screen.getByText(/BTC/)).toBeTruthy();
    // La valorisation reste affichée : c'est la règle.
    expect(screen.getByText(/12.480,65/)).toBeTruthy();
    // Donnée dégradée, pas panne ni simple information : c'est l'avertissement que D70
    // réserve à cet état.
    expect(bandeau.closest('.message').className).toContain('message--avertissement');
  });

  it('nomme les actifs sans aucun cours et dit qu\'ils sortent du total', async () => {
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, cours_indisponibles: ['XAU'] });
    rendre();

    expect(await screen.findByText(/XAU/)).toBeTruthy();
    const bandeau = screen.getByText(/n'entrent pas dans le total/);
    // Un cours absent est une donnée incomplète, pas une perte financière : le rouge
    // ferait lire une baisse là où il n'y a qu'un trou (D70).
    expect(bandeau.closest('.message').className).toContain('message--avertissement');
  });

  // Une carte vide intitulée « Seuils franchis » inquiéterait pour rien.
  it('fait disparaître le bloc des seuils lorsqu\'aucun n\'est franchi', async () => {
    rendre();
    await screen.findByText(/12.480,65/);
    expect(screen.queryByText('Seuils franchis')).toBeNull();
  });

  it('affiche les seuils franchis lorsqu\'il y en a', async () => {
    // Les valeurs employées ici sont celles que contraint backend/db/schema.sql :
    // 'capital_total' ou 'actif' pour la cible, 'au_dessus' ou 'en_dessous' pour le
    // sens. Une fixture qui en inventerait d'autres validerait un composant faux.
    api.portefeuille.mockResolvedValue({
      ...PORTEFEUILLE,
      alertes_declenchees: [
        {
          id: 7,
          type_cible: 'capital_total',
          actif_id: null,
          symbole: null,
          sens_seuil: 'au_dessus',
          valeur_seuil: '12000.00',
          valeur_observee: '12480.65',
        },
      ],
    });
    rendre();

    expect(await screen.findByText('Seuils franchis')).toBeTruthy();
    const seuil = screen
      .getAllByRole('listitem')
      .find((entree) => entree.textContent.includes('Patrimoine total'));
    expect(seuil.textContent).toMatch(/Patrimoine total a dépassé/);
    expect(seuil.textContent).toMatch(/12.000/);
  });

  it('nomme le seuil d\'un actif descendu sous sa valeur', async () => {
    api.portefeuille.mockResolvedValue({
      ...PORTEFEUILLE,
      alertes_declenchees: [
        {
          id: 8,
          type_cible: 'actif',
          actif_id: 1,
          symbole: 'BTC',
          sens_seuil: 'en_dessous',
          valeur_seuil: '50000.00',
          valeur_observee: '48200.00',
        },
      ],
    });
    rendre();

    await screen.findByText('Seuils franchis');
    const seuil = screen
      .getAllByRole('listitem')
      .find((entree) => entree.textContent.includes('BTC est'));
    expect(seuil.textContent).toMatch(/BTC est descendu sous/);
  });

  it('recharge la courbe au changement de période', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    await utilisateur.click(screen.getByRole('tab', { name: /Année/ }));

    await waitFor(() => expect(api.historique).toHaveBeenCalledWith('jeton-de-test', 365));
  });
});

describe('états', () => {
  it('affiche un squelette calqué sur la composition pendant le chargement', () => {
    api.portefeuille.mockReturnValue(new Promise(() => {}));
    api.historique.mockReturnValue(new Promise(() => {}));
    const { container } = rendre();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelectorAll('.squelette').length).toBeGreaterThan(0);
    // Jamais un rond tournant : la forme annonce ce qui va s'afficher.
    expect(screen.getByRole('status').textContent).toMatch(/Chargement/);
  });

  it('accueille un compte neuf par un texte et une action unique', async () => {
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [], repartition: [] });
    rendre({ premierLancement: true });

    expect(await screen.findByText(/Bienvenue, Camille/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /première position/ })).toBeTruthy();
    // Ni courbe, ni répartition, ni chiffres de contexte.
    expect(screen.queryByText('Répartition')).toBeNull();
    expect(screen.queryByText('Montant investi')).toBeNull();
  });

  // Un portefeuille devenu vide n'est pas un premier lancement : le texte diffère.
  it('distingue un portefeuille vidé d\'un premier lancement', async () => {
    api.portefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [], repartition: [] });
    rendre();

    expect(await screen.findByText('Aucune position')).toBeTruthy();
    expect(screen.queryByText(/Bienvenue/)).toBeNull();
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

  it('propose de réessayer après une erreur, et recharge', async () => {
    const utilisateur = userEvent.setup();
    api.portefeuille.mockRejectedValueOnce(new ErreurApi('Service indisponible.', 500));
    rendre();

    await utilisateur.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText(/12.480,65/)).toBeTruthy();
  });

  it('annonce une session expirée plutôt que de rediriger sans rien dire', async () => {
    api.portefeuille.mockRejectedValue(new ErreurApi('Jeton expiré.', 401));
    rendre();

    expect(await screen.findByText('Session expirée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se reconnecter' })).toBeTruthy();
  });

  // Des données déjà affichées valent mieux qu'une page blanche : l'incident s'ajoute.
  it('conserve les données affichées quand un rechargement échoue', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    api.historique.mockRejectedValue(new ErreurApi('Le serveur est injoignable.', 0));
    await utilisateur.click(screen.getByRole('tab', { name: /Semaine/ }));

    expect(await screen.findByText('Connexion indisponible')).toBeTruthy();
    expect(screen.getByText(/12.480,65/)).toBeTruthy();
  });
});

describe('accessibilité', () => {
  it('donne au sélecteur de période un vrai groupe d\'onglets navigable aux flèches', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    const onglets = screen.getAllByRole('tab');
    expect(onglets).toHaveLength(5);

    const actif = screen.getByRole('tab', { selected: true });
    expect(actif.textContent).toMatch(/Mois/);

    actif.focus();
    await utilisateur.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/Année/);

    await utilisateur.keyboard('{Home}');
    expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/Jour/);
  });

  it('restitue la répartition en liste, avec libellé, part et montant', async () => {
    rendre();

    // La répartition n'est plus un graphique mais une liste (D74) : elle n'a donc pas
    // de description à fournir, elle se lit directement, entrée par entrée.
    await screen.findByText(/12.480,65/);
    const entrees = screen.getAllByRole('listitem');
    const crypto = entrees.find((entree) => entree.textContent.includes('Cryptomonnaie'));

    expect(crypto).toBeTruthy();
    expect(crypto.textContent).toMatch(/59,9/);
    expect(crypto.textContent).toMatch(/7.480,65/);
    // Aucune pastille de couleur ne porte l'information : le jeton de forme suffit.
    expect(crypto.querySelector('.repartition__teinte')).toBeNull();
    expect(crypto.querySelector('.jeton-classe__forme')).toBeTruthy();
  });

  it('décrit la courbe en toutes lettres', async () => {
    rendre();

    const courbe = await screen.findByRole('img', { name: /Évolution de la valeur/ });
    expect(courbe.getAttribute('aria-label')).toMatch(/2026-08-09/);
  });
});
