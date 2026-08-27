import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetailPosition from '../DetailPosition';
import * as contexte from '../../contexte/contexteAuthentification';
import { api, ErreurApi } from '../../services/api';

// L'écran est testé sur ce qui se casse en silence : l'effet des mouvements sur le prix
// de revient, l'ordre de la frise, et les deux confirmations de suppression, dont la
// formulation est ce qui distingue un garde-fou d'un simple clic de plus.
//
// Les mouvements sont ceux que le serveur renvoie, déjà enrichis : aucune de ces valeurs
// n'est recalculée par l'interface, et le jeu d'essai reproduit donc la forme exacte de
// la réponse plutôt qu'une forme inventée.
//
// Les chiffres sont ceux que le moteur produit réellement sur ces trois mouvements :
// (0,5 x 54 000 + 15 + 0,3 x 61 000 + 10) / 0,8 donne un prix de revient de 56 656,25,
// et la vente de 0,2 à 63 500 dégage 1 360,75 une fois ses 8 de frais déduits.

const MOUVEMENTS = [
  {
    id: 1,
    sens: 'achat',
    quantite: '0.50000000',
    prix_unitaire: '54000.00',
    frais: '15.00',
    date_transaction: '2026-05-27T10:00:00.000Z',
    note: 'Achat initial',
    montant: '27000.00',
    pru_avant: '0',
    pru_apres: '54030',
    effet_pru: '54030',
    quantite_apres: '0.5',
    plus_value_realisee: null,
  },
  {
    id: 2,
    sens: 'achat',
    quantite: '0.30000000',
    prix_unitaire: '61000.00',
    frais: '10.00',
    date_transaction: '2026-07-02T10:00:00.000Z',
    note: 'Renforcement',
    montant: '18300.00',
    pru_avant: '54030',
    pru_apres: '56656.25',
    effet_pru: '2626.25',
    quantite_apres: '0.8',
    plus_value_realisee: null,
  },
  {
    id: 3,
    sens: 'vente',
    quantite: '0.20000000',
    prix_unitaire: '63500.00',
    frais: '8.00',
    date_transaction: '2026-08-03T10:00:00.000Z',
    note: 'Prise de bénéfice partielle',
    montant: '12700.00',
    pru_avant: '56656.25',
    pru_apres: '56656.25',
    effet_pru: '0',
    quantite_apres: '0.6',
    plus_value_realisee: '1360.75',
  },
];

const DETAIL = {
  id: 1,
  utilisateur_id: 2,
  type: 'crypto',
  symbole: 'BTC',
  nom: 'Bitcoin',
  date_ajout: '2026-05-27T10:00:00.000Z',
  cours_eur: '60801.20',
  source_cours: 'coinbase',
  horodatage_cours: '2026-08-23T08:00:00.000Z',
  quantite_detenue: '0.6',
  pru: '56656.25',
  cout_total: '33993.75',
  valeur: '36480.72',
  plus_value_latente: '2486.97',
  plus_value_realisee: '1360.75',
  pourcentage_variation: '7.32',
  transactions: MOUVEMENTS,
  historique: { points: [], performances: {} },
  taux_affichage: {
    eur_vers_usd: '1.1699',
    usd_vers_eur: '0.85477',
    horodatage: '2026-08-23T00:00:00.000Z',
  },
};

// Deux seuils, dont un sur le capital total : il ne cible pas cette position et ne doit
// pas apparaître ici.
const ALERTES = [
  {
    id: 5,
    utilisateur_id: 2,
    actif_id: 1,
    type_cible: 'actif',
    sens_seuil: 'au_dessus',
    valeur_seuil: '70000.00',
    statut: 'active',
    date_creation: '2026-06-01T10:00:00.000Z',
    date_declenchement: null,
    symbole: 'BTC',
    nom_actif: 'Bitcoin',
  },
  {
    id: 6,
    utilisateur_id: 2,
    actif_id: null,
    type_cible: 'capital_total',
    sens_seuil: 'au_dessus',
    valeur_seuil: '45000.00',
    statut: 'active',
    date_creation: '2026-06-01T10:00:00.000Z',
    date_declenchement: null,
    symbole: null,
    nom_actif: null,
  },
];

function rendre() {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    jeton: 'jeton-de-test',
    utilisateur: { pseudo: 'Camille' },
    estConnecte: true,
  });

  return render(
    <MemoryRouter initialEntries={['/positions/1']}>
      <Routes>
        <Route path="/positions" element={<p>Liste des positions</p>} />
        <Route path="/positions/:id" element={<DetailPosition />} />
      </Routes>
    </MemoryRouter>
  );
}

function evenementsDeLaFrise() {
  return within(screen.getByRole('list', { name: '' })).queryAllByRole('listitem');
}

// Le graphe est chargé à la demande, dans un fragment séparé. Sans cette précharge, la
// première assertion qui l'attend court contre la résolution de ce fragment, et échoue
// par intermittence quand la suite entière s'exécute en parallèle. L'import le résout
// une fois pour toutes ; ni le composant ni ce qui est vérifié n'en sont modifiés.
beforeAll(async () => {
  await import('../../composants/Courbe');
});

beforeEach(() => {
  vi.spyOn(api, 'actif').mockResolvedValue(DETAIL);
  vi.spyOn(api, 'alertes').mockResolvedValue(ALERTES);
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('composition de la fiche', () => {
  it("nomme la position, sa classe et la source de son cours", async () => {
    rendre();

    expect(await screen.findByRole('heading', { name: 'Bitcoin', level: 1 })).toBeTruthy();
    expect(screen.getByText(/BTC · Cryptomonnaie/)).toBeTruthy();
    expect(screen.getByLabelText(/Cours à jour, source coinbase/)).toBeTruthy();
  });

  it('présente la valorisation, la plus-value et le trio de contexte', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    expect(screen.getByText('Valorisation de la position')).toBeTruthy();
    expect(screen.getByText('Quantité détenue')).toBeTruthy();
    expect(screen.getByText('Cours actuel')).toBeTruthy();
    expect(screen.getByText('Prix de revient')).toBeTruthy();
  });

  // Le serveur répond 404 sur la ressource d'un autre compte comme sur une ressource
  // inexistante (D52) : l'écran ne cherche pas non plus à les distinguer.
  it('traite une position introuvable sans révéler si elle existe ailleurs', async () => {
    api.actif.mockRejectedValue(new ErreurApi('Actif introuvable.', 404));
    rendre();

    expect(await screen.findByText('Position introuvable')).toBeTruthy();
    expect(screen.queryByText(/appartient/i)).toBeNull();
  });

  it("signale un cours indisponible sans vider la fiche", async () => {
    api.actif.mockResolvedValue({
      ...DETAIL,
      cours_eur: null,
      source_cours: null,
      valeur: null,
      plus_value_latente: null,
      pourcentage_variation: null,
    });
    rendre();

    expect(await screen.findByText(/Aucun cours disponible pour BTC/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Bitcoin', level: 1 })).toBeTruthy();
  });

  // Cas impossible dans le modèle, un actif naissant d'un premier achat. Traité en
  // défensif : la fiche reste lisible et le dit en clair.
  it("reste lisible sur une position sans aucun mouvement", async () => {
    api.actif.mockResolvedValue({ ...DETAIL, transactions: [] });
    rendre();

    expect(await screen.findByText('Aucun mouvement enregistré sur cette position.')).toBeTruthy();
  });
});

describe('frise des mouvements', () => {
  it('chiffre le déplacement du prix de revient provoqué par chaque mouvement', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    // Un intitulé par mouvement : la colonne n'est pas réservée aux achats.
    expect(screen.getAllByText('Effet sur le prix de revient')).toHaveLength(3);
  });

  // Une vente partielle laisse le prix de revient intact. Le dire vaut mieux que
  // d'afficher « +0,00 », que l'utilisateur aurait à interpréter.
  it("écrit « inchangé » plutôt qu'un zéro sur une vente partielle", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    expect(screen.getByText('inchangé')).toBeTruthy();
  });

  it('affiche la plus-value dégagée par une vente, et par elle seule', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    expect(screen.getAllByText('Plus-value réalisée')).toHaveLength(1);
  });

  it('va du plus récent au plus ancien', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    const evenements = evenementsDeLaFrise();
    expect(evenements[0].textContent).toContain('Vente');
    expect(evenements[evenements.length - 1].textContent).toContain('Achat initial'.slice(0, 5));
  });

  it('est une liste ordonnée sémantique', async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    expect(screen.getByRole('list').tagName).toBe('OL');
  });
});

describe('onglets', () => {
  it("bascule vers les seuils aux flèches du clavier", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    const mouvements = screen.getByRole('tab', { name: /Mouvements/ });
    mouvements.focus();
    await utilisateur.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /Seuils/ }).getAttribute('aria-selected')).toBe('true');
    expect(mouvements.getAttribute('aria-selected')).toBe('false');
  });

  // Un seul onglet est atteignable à la tabulation : c'est ce qui distingue un groupe
  // d'onglets d'une rangée de boutons.
  it("ne place qu'un seul onglet dans l'ordre de tabulation", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    // L'écran porte deux groupes d'onglets, le sélecteur de période et celui-ci :
    // l'assertion vise explicitement le second.
    const groupe = within(screen.getByRole('tablist', { name: 'Détail de la position' }));
    const atteignables = groupe
      .getAllByRole('tab')
      .filter((onglet) => onglet.getAttribute('tabindex') === '0');
    expect(atteignables).toHaveLength(1);
  });

  it("n'affiche que les seuils posés sur cette position", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('tab', { name: /Seuils/ }));

    expect(screen.getByText(/Au-dessus de/)).toBeTruthy();
    // Le seuil sur le capital total ne cible pas cette position.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  // La barre ne porte jamais l'information seule : les deux montants l'accompagnent, et
  // l'avancement est énoncé en toutes lettres pour un lecteur d'écran.
  it('énonce la progression vers le seuil autrement que par la barre', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });
    await utilisateur.click(screen.getByRole('tab', { name: /Seuils/ }));

    const barre = screen.getByRole('progressbar');
    expect(barre.getAttribute('aria-valuetext')).toMatch(/% du seuil haut/);
  });
});

describe('suppression', () => {
  it("nomme la conséquence avant de supprimer un achat", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    const suppressions = screen.getAllByRole('button', { name: /Supprimer achat/ });
    await utilisateur.click(suppressions[0]);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/recalculera le prix de revient/)).toBeTruthy();
  });

  it("annonce que les mouvements disparaîtront avec la position", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer la position' }));

    expect(screen.getByText(/3 mouvements enregistrés sur cette position seront supprimés/)).toBeTruthy();
    expect(screen.getByText(/irréversible/)).toBeTruthy();
  });

  // Le bouton destructeur ne doit jamais recevoir le focus à l'ouverture : une
  // confirmation validée par une frappe d'Entrée réflexe n'aurait rien confirmé.
  it("place le focus sur l'annulation et non sur le bouton destructeur", async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer la position' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Annuler' }));
  });

  it('se ferme par Échap sans rien supprimer', async () => {
    const utilisateur = userEvent.setup();
    vi.spyOn(api, 'supprimerActif').mockResolvedValue(null);
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer la position' }));
    await utilisateur.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.supprimerActif).not.toHaveBeenCalled();
  });

  it('supprime la position confirmée et revient à la liste', async () => {
    const utilisateur = userEvent.setup();
    vi.spyOn(api, 'supprimerActif').mockResolvedValue(null);
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer la position' }));
    // Le dialogue est modal : c'est son propre bouton qu'il faut viser, et non celui de
    // la page qui l'a ouvert, qui porte le même libellé.
    const dialogue = within(screen.getByRole('dialog'));
    await utilisateur.click(dialogue.getByRole('button', { name: 'Supprimer la position' }));

    expect(api.supprimerActif).toHaveBeenCalledWith('jeton-de-test', '1');
    expect(await screen.findByText('Liste des positions')).toBeTruthy();
  });

  // Le prix de revient et tout ce qui en dépend viennent de changer : c'est le serveur
  // qui les recalcule, l'écran ne retire pas une ligne de son côté.
  it('recharge la fiche après la suppression d\'un mouvement', async () => {
    const utilisateur = userEvent.setup();
    vi.spyOn(api, 'supprimerTransaction').mockResolvedValue(null);
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getAllByRole('button', { name: /Supprimer achat/ })[0]);
    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer le mouvement' }));

    expect(api.supprimerTransaction).toHaveBeenCalledWith('jeton-de-test', '1', 2);
    expect(api.actif).toHaveBeenCalledTimes(2);
  });
});

describe('graphe de cours', () => {
  const SERIE = [
    { date_snapshot: '2026-08-19', cours_eur: '54000.00', quantite: '0.6' },
    { date_snapshot: '2026-08-20', cours_eur: '57200.00', quantite: '0.6' },
    { date_snapshot: '2026-08-21', cours_eur: '59100.00', quantite: '0.6' },
    { date_snapshot: '2026-08-22', cours_eur: '60100.00', quantite: '0.6' },
    { date_snapshot: '2026-08-23', cours_eur: '60801.20', quantite: '0.6' },
  ];

  // L'historique s'amorce à la première consultation : une position trop jeune n'a pas
  // assez de points, et rien n'est interpolé pour combler les jours manquants.
  it("annonce l'absence d'historique plutôt que de tracer une ligne inventée", async () => {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    expect(screen.getByText(/s'affichera après quelques jours de suivi/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  // D79 : la description accessible nomme explicitement la ligne de prix de revient.
  // Sans elle, le tracé annoncerait une évolution sans dire par rapport à quoi il se
  // teinte, c'est-à-dire sans dire ce que le graphe existe pour montrer.
  it('nomme la ligne de prix de revient dans sa description', async () => {
    api.actif.mockResolvedValue({
      ...DETAIL,
      historique: { points: SERIE, performances: { jour: '1.17', mois: '12.59', origine: '12.59' } },
    });
    rendre();

    const graphe = await screen.findByRole('img');
    expect(graphe.getAttribute('aria-label')).toMatch(/cours de Bitcoin/);
    expect(graphe.getAttribute('aria-label')).toMatch(/prix de revient/i);
    expect(graphe.getAttribute('aria-label')).toMatch(/pointill/);
  });

  it("affiche la performance de chaque plage sans qu'il faille cliquer", async () => {
    api.actif.mockResolvedValue({
      ...DETAIL,
      historique: { points: SERIE, performances: { jour: '1.17', mois: '12.59', origine: '12.59' } },
    });
    rendre();
    await screen.findByRole('img');

    const plages = within(screen.getByRole('tablist', { name: 'Période de la courbe' }));
    expect(plages.getAllByRole('tab')).toHaveLength(5);
  });
});

describe('saisie d’un mouvement', () => {
  // La fiche ne connaît qu'une position : la feuille s'ouvre déjà réglée sur elle, le
  // sélecteur n'ayant rien d'autre à proposer.
  it('ouvre la feuille déjà réglée sur la position consultée', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));

    expect(screen.getByRole('dialog', { name: 'Nouveau mouvement' })).toBeTruthy();
    expect(screen.getByLabelText(/^Actif/).value).toBe('1');
    // Le cours de la fiche est proposé comme prix unitaire, sans requête de plus.
    expect(screen.getByLabelText(/^Prix unitaire/).value).toBe('60801.20');
  });

  // La quantité détenue vient du serveur : la feuille la relaie, elle ne la recalcule pas.
  it('borne la vente à la quantité que le serveur a rendue', async () => {
    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));
    await utilisateur.click(screen.getByRole('radio', { name: 'Vente' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Tout vendre' }));

    expect(screen.getByLabelText(/^Quantité/).value).toBe('0.6');
  });

  it('recharge la fiche après un enregistrement', async () => {
    vi.spyOn(api, 'simulerTransaction').mockResolvedValue({
      sens: 'achat',
      montant: '6080.12',
      frais: '0',
      quantite_detenue_avant: '0.6',
      quantite_detenue_apres: '0.7',
      pru_avant: '56656.25',
      pru_apres: '57249.06',
      effet_pru: '592.81',
      plus_value_realisee: null,
      cout_total_apres: '40074.34',
    });
    vi.spyOn(api, 'creerTransaction').mockResolvedValue({
      id: 60,
      actif_id: 1,
      sens: 'achat',
      quantite: '0.10000000',
      prix_unitaire: '60801.20',
      frais: '0',
      date_transaction: '2026-08-25T10:00:00.000Z',
      note: null,
    });

    const utilisateur = userEvent.setup();
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));
    await utilisateur.type(screen.getByLabelText(/^Quantité/), '0.1');
    await screen.findByText(/57\s?249,06/);
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/Achat de 0,1\sBTC enregistré/)).toBeTruthy();
    expect(api.actif).toHaveBeenCalledTimes(2);
  });
});

// Spécification E4, section Interactions : « Création d'un seuil pré-réglée sur cet
// actif. » L'écran de détail ne connaît qu'une position : la feuille s'ouvre restreinte
// à elle, sans proposer le patrimoine total, dont la valeur n'est pas chargée ici (D83).
describe('saisie d’un seuil depuis l’onglet Seuils', () => {
  async function ouvrirOngletSeuils(utilisateur) {
    rendre();
    await screen.findByRole('heading', { name: 'Bitcoin', level: 1 });
    await utilisateur.click(screen.getByRole('tab', { name: /Seuils/ }));
  }

  it('propose la création même quand des seuils existent déjà', async () => {
    const utilisateur = userEvent.setup();
    await ouvrirOngletSeuils(utilisateur);

    expect(screen.getByRole('button', { name: '+ Seuil' })).toBeTruthy();
  });

  it('propose la création sur une position sans aucun seuil', async () => {
    api.alertes.mockResolvedValue([]);
    const utilisateur = userEvent.setup();
    await ouvrirOngletSeuils(utilisateur);

    expect(screen.getByText('Aucun seuil ne surveille cette position.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Seuil' })).toBeTruthy();
  });

  it('ouvre la feuille déjà réglée sur la position, sans option de patrimoine total', async () => {
    const utilisateur = userEvent.setup();
    await ouvrirOngletSeuils(utilisateur);

    await utilisateur.click(screen.getByRole('button', { name: '+ Seuil' }));

    expect(screen.getByRole('dialog', { name: 'Nouveau seuil — Bitcoin (BTC)' })).toBeTruthy();
    expect(screen.getByLabelText('Cible').value).toBe('actif:1');
    const options = within(screen.getByLabelText('Cible')).getAllByRole('option');
    expect(options.map((option) => option.value)).not.toContain('capital_total');
  });

  it('recharge la fiche et confirme après la création du seuil', async () => {
    vi.spyOn(api, 'creerAlerte').mockResolvedValue({
      id: 12,
      utilisateur_id: 2,
      actif_id: 1,
      type_cible: 'actif',
      sens_seuil: 'au_dessus',
      valeur_seuil: '75000.00',
      statut: 'active',
      date_creation: '2026-08-26T10:00:00.000Z',
      date_declenchement: null,
    });

    const utilisateur = userEvent.setup();
    await ouvrirOngletSeuils(utilisateur);

    await utilisateur.click(screen.getByRole('button', { name: '+ Seuil' }));
    await utilisateur.type(screen.getByLabelText(/^Seuil de déclenchement/), '75000');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le seuil' }));

    expect(await screen.findByText(/Seuil créé pour Bitcoin \(BTC\)/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.actif).toHaveBeenCalledTimes(2);
  });
});

