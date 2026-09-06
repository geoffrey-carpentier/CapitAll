import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Patrimoine from '../Patrimoine';
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
    <MemoryRouter initialEntries={[{ pathname: '/patrimoine', state: etat }]}>
      <Patrimoine />
    </MemoryRouter>
  );
}

// Le graphe est chargé à la demande, dans un fragment séparé. Sans cette précharge, la
// première assertion qui l'attend court contre la résolution de ce fragment, et échoue
// par intermittence quand la suite entière s'exécute en parallèle. L'import le résout
// une fois pour toutes ; ni le composant ni ce qui est vérifié n'en sont modifiés.
beforeAll(async () => {
  await import('../../composants/Courbe');
});

beforeEach(() => {
  vi.spyOn(api, 'actualiserPortefeuille').mockResolvedValue(PORTEFEUILLE);
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

    const appelsAvant = api.actualiserPortefeuille.mock.calls.length + api.historique.mock.calls.length;
    await utilisateur.click(screen.getByLabelText('Afficher les montants en dollars'));

    // 12480,65 x 1,1364 = 14183,0106, arrondi au centime.
    expect(await screen.findByText(/14.183,01/)).toBeTruthy();
    expect(api.actualiserPortefeuille.mock.calls.length + api.historique.mock.calls.length).toBe(appelsAvant);
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
    api.actualiserPortefeuille.mockResolvedValue({
      ...PORTEFEUILLE,
      actifs: [PORTEFEUILLE.actifs[0]],
      repartition: [{ type: 'crypto', valeur: '12480.65', pourcentage: '100.00' }],
    });
    rendre();

    await screen.findByText(/12.480,65/);
    expect(screen.queryByText('Répartition')).toBeNull();
  });

  // La répartition pose la question « qu'est-ce qui pèse le plus » ; la suivante est
  // toujours « de quoi cette part est-elle faite ». Chaque entrée mène donc aux positions
  // de sa classe, avec le filtre que l'écran Positions lit déjà dans l'adresse.
  it('renvoie aux positions de la classe depuis la répartition', async () => {
    rendre();
    await screen.findByText('Répartition');

    expect(
      screen.getByRole('link', { name: 'Voir les positions de la classe Cryptos' })
        .getAttribute('href')
    ).toBe('/positions?classes=crypto');
    expect(
      screen.getByRole('link', { name: 'Voir les positions de la classe Action' })
        .getAttribute('href')
    ).toBe('/positions?classes=action');
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
    api.actualiserPortefeuille.mockResolvedValue({
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
    api.actualiserPortefeuille.mockResolvedValue({ ...PORTEFEUILLE, cours_indisponibles: ['XAU'] });
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
    api.actualiserPortefeuille.mockResolvedValue({
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
    api.actualiserPortefeuille.mockResolvedValue({
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

  // Changer de plage est un découpage d'affichage sur une série déjà reçue. Ce n'en
  // était pas un : chaque clic rechargeait le portefeuille entier, donc rappelait les
  // fournisseurs de cours et réécrivait les deux séries historiques.
  it('ne redemande rien au serveur au changement de période', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    const appels =
      api.actualiserPortefeuille.mock.calls.length + api.historique.mock.calls.length;

    await utilisateur.click(screen.getByRole('tab', { name: /Année/ }));
    await utilisateur.click(screen.getByRole('tab', { name: /Semaine/ }));
    await utilisateur.click(screen.getByRole('tab', { name: /Jour/ }));

    expect(
      api.actualiserPortefeuille.mock.calls.length + api.historique.mock.calls.length
    ).toBe(appels);
  });

  it('découpe la série sur la plage choisie, en jours et non en nombre de points', async () => {
    // Série volontairement trouée : c'est le cas réel, le point du jour n'étant écrit
    // que si l'utilisateur a consulté. Un découpage par nombre de points aurait rendu
    // les sept derniers relevés, soit dix mois, sous l'étiquette « Semaine ».
    api.historique.mockResolvedValue({
      points: [
        { date_snapshot: '2025-10-01', valeur_totale_eur: '9000.00' },
        { date_snapshot: '2026-02-14', valeur_totale_eur: '9500.00' },
        { date_snapshot: '2026-07-20', valeur_totale_eur: '11000.00' },
        { date_snapshot: '2026-08-05', valeur_totale_eur: '12000.00' },
        { date_snapshot: '2026-08-10', valeur_totale_eur: '12200.00' },
        { date_snapshot: '2026-08-11', valeur_totale_eur: '12480.65' },
      ],
      performances: HISTORIQUE.performances,
    });

    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    // Par défaut le mois : le point de février est hors fenêtre, celui du 20 juillet
    // dedans. Six relevés au total, dont quatre seulement dans les trente jours.
    let courbe = await screen.findByRole('img', { name: /Évolution de la valeur/ });
    expect(courbe.getAttribute('aria-label')).toMatch(/2026-07-20/);

    await utilisateur.click(screen.getByRole('tab', { name: /Semaine/ }));
    courbe = await screen.findByRole('img', { name: /Évolution de la valeur/ });
    expect(courbe.getAttribute('aria-label')).toMatch(/2026-08-05/);

    await utilisateur.click(screen.getByRole('tab', { name: /Suivi/ }));
    courbe = await screen.findByRole('img', { name: /Évolution de la valeur/ });
    expect(courbe.getAttribute('aria-label')).toMatch(/2025-10-01/);
  });

  // DATA-04 : le pas de la courbe n'est pas régulier, et le taire reviendrait à laisser
  // croire à un relevé de clôture quotidien.
  it('annonce que le relevé est pris à l\'heure de la consultation', async () => {
    api.historique.mockResolvedValue({
      ...HISTORIQUE,
      points: HISTORIQUE.points.map((point, rang) => ({
        ...point,
        heure_releve: rang === 2 ? '2026-08-11T20:32:00.000Z' : null,
      })),
    });

    rendre();
    await screen.findByText(/12.480,65/);

    expect(screen.getByText(/à l'heure de votre consultation/)).toBeTruthy();
    expect(screen.getByText(/Dernier relevé le 11 août/)).toBeTruthy();
  });

  it('se contente de la mention générale quand l\'heure du relevé est inconnue', async () => {
    // Les points antérieurs à l'introduction de la colonne n'ont pas d'heure : inventer
    // une valeur serait pire que de ne rien dire.
    rendre();
    await screen.findByText(/12.480,65/);

    expect(screen.getByText(/à l'heure de votre consultation/)).toBeTruthy();
    expect(screen.queryByText(/Dernier relevé/)).toBeNull();
  });

  // Les deux boutons de la barre d'outils ne se confondent pas.
  //
  // La feuille d'écran masque le bouton de saisie sous 900 px, la barre basse portant
  // alors l'action. La règle visait la classe générique des boutons : le bouton
  // d'actualisation, ajouté dans la même barre, disparaissait avec lui — sur une
  // application pensée pour le mobile, la commande n'existait que sur grand écran. La
  // classe dédiée est ce qui permet à la règle de ne viser que le bon.
  it('donne au bouton de saisie une classe qui lui est propre', async () => {
    rendre();
    await screen.findByText(/12.480,65/);

    expect(screen.getByRole('button', { name: '+ Mouvement' }).className).toContain(
      'patrimoine__ajout'
    );
    expect(screen.getByRole('button', { name: 'Actualiser' }).className).not.toContain(
      'patrimoine__ajout'
    );
  });

  // L'actualisation est désormais demandée, jamais déduite de l'affichage.
  it('relève les cours à la demande, et une seule fois par affichage', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    expect(api.actualiserPortefeuille).toHaveBeenCalledTimes(1);

    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser' }));

    await waitFor(() => expect(api.actualiserPortefeuille).toHaveBeenCalledTimes(2));
    expect(api.historique).toHaveBeenCalledTimes(2);
  });
});

describe('états', () => {
  it('affiche un squelette calqué sur la composition pendant le chargement', () => {
    api.actualiserPortefeuille.mockReturnValue(new Promise(() => {}));
    api.historique.mockReturnValue(new Promise(() => {}));
    const { container } = rendre();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelectorAll('.squelette').length).toBeGreaterThan(0);
    // Jamais un rond tournant : la forme annonce ce qui va s'afficher.
    expect(screen.getByRole('status').textContent).toMatch(/Chargement/);
  });

  it('accueille un compte neuf par un texte et une action unique', async () => {
    api.actualiserPortefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [], repartition: [] });
    rendre({ premierLancement: true });

    expect(await screen.findByText(/Bienvenue, Camille/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /première position/ })).toBeTruthy();
    // Ni courbe, ni répartition, ni chiffres de contexte.
    expect(screen.queryByText('Répartition')).toBeNull();
    expect(screen.queryByText('Montant investi')).toBeNull();
  });

  // Un portefeuille devenu vide n'est pas un premier lancement : le texte diffère.
  it('distingue un portefeuille vidé d\'un premier lancement', async () => {
    api.actualiserPortefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [], repartition: [] });
    rendre();

    expect(await screen.findByText('Aucune position')).toBeTruthy();
    expect(screen.queryByText(/Bienvenue/)).toBeNull();
  });

  it('distingue une erreur du serveur d\'une coupure réseau', async () => {
    api.actualiserPortefeuille.mockRejectedValue(new ErreurApi('Service indisponible.', 500));
    const { unmount } = rendre();
    expect(await screen.findByText('Données indisponibles')).toBeTruthy();
    unmount();

    api.actualiserPortefeuille.mockRejectedValue(new ErreurApi('Le serveur est injoignable.', 0));
    rendre();
    expect(await screen.findByText('Connexion indisponible')).toBeTruthy();
  });

  it('propose de réessayer après une erreur, et recharge', async () => {
    const utilisateur = userEvent.setup();
    api.actualiserPortefeuille.mockRejectedValueOnce(new ErreurApi('Service indisponible.', 500));
    rendre();

    await utilisateur.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText(/12.480,65/)).toBeTruthy();
  });

  it('annonce une session expirée plutôt que de rediriger sans rien dire', async () => {
    api.actualiserPortefeuille.mockRejectedValue(new ErreurApi('Jeton expiré.', 401));
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
    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser' }));

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
    const crypto = entrees.find((entree) => entree.textContent.includes('Cryptos'));

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

describe('saisie d’un mouvement', () => {
  const EFFET = {
    sens: 'achat',
    montant: '1000.00',
    frais: '0',
    quantite_detenue_avant: '0.5',
    quantite_detenue_apres: '0.6',
    pru_avant: '9000',
    pru_apres: '9100',
    effet_pru: '100',
    plus_value_realisee: null,
    cout_total_apres: '5460.00',
  };

  // La saisie n'est jamais une page : la feuille se pose par-dessus le patrimoine, qui
  // reste affiché derrière elle.
  it("ouvre la feuille depuis l'en-tête sans quitter l'écran", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);

    await utilisateur.click(screen.getByRole('button', { name: '+ Mouvement' }));

    expect(screen.getByRole('dialog', { name: 'Nouveau mouvement' })).toBeTruthy();
    expect(screen.getByText('Valeur totale')).toBeTruthy();
  });

  // Sans cette porte d'entrée, un compte neuf n'aurait aucun moyen d'enregistrer son
  // premier mouvement : c'est le premier pas du parcours de découverte.
  it("ouvre la feuille depuis l'état vide", async () => {
    const utilisateur = userEvent.setup();
    api.actualiserPortefeuille.mockResolvedValue({ ...PORTEFEUILLE, actifs: [], repartition: [] });
    rendre();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Ajouter votre première position' })
    );

    expect(screen.getByRole('dialog', { name: 'Nouveau mouvement' })).toBeTruthy();
  });

  // Le mouvement change le patrimoine, le prix de revient et les plus-values : c'est le
  // serveur qui les recalcule, l'écran se recharge plutôt que d'ajuster ses chiffres.
  it('recharge le patrimoine et confirme après un enregistrement', async () => {
    vi.spyOn(api, 'simulerTransaction').mockResolvedValue(EFFET);
    vi.spyOn(api, 'creerTransaction').mockResolvedValue({
      id: 51,
      actif_id: 1,
      sens: 'achat',
      quantite: '0.10000000',
      prix_unitaire: '10000.00',
      frais: '0',
      date_transaction: '2026-08-25T10:00:00.000Z',
      note: null,
    });

    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByText(/12.480,65/);
    const chargements = api.actualiserPortefeuille.mock.calls.length;

    await utilisateur.click(screen.getByRole('button', { name: '+ Mouvement' }));
    await utilisateur.selectOptions(screen.getByLabelText(/^Actif/), '1');
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.1');
    await utilisateur.type(screen.getByLabelText(/^Prix unitaire/), '10000');

    // L'enregistrement n'est possible qu'une fois l'effet du mouvement obtenu.
    await screen.findByText(/9\s?100/);
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/Achat de 0,1\sBTC enregistré/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(api.actualiserPortefeuille.mock.calls.length).toBeGreaterThan(chargements));
  });
});
