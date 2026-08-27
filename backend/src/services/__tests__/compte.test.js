import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Comme pour l'authentification, les modèles sont des doublures : ces tests portent sur
// les règles du service, pas sur l'accès aux données. bcrypt, lui, n'est pas simulé —
// c'est le hachage réel qui doit être vérifié.
const MOT_DE_PASSE = 'motdepasse-actuel';
const NOUVEAU = 'motdepasse-nouveau';

let creerServiceCompte;
let hachage;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/capitall';
  process.env.JWT_SECRET = 'f'.repeat(32);
  ({ creerServiceCompte } = await import('../compte.js'));
  // Haché une seule fois : bcrypt au coût 10 est volontairement lent.
  hachage = await bcrypt.hash(MOT_DE_PASSE, 10);
});

function compte() {
  return {
    id: 7,
    email: 'camille@example.fr',
    pseudo: 'Camille',
    role: 'utilisateur',
    actif: true,
    mot_de_passe_hache: hachage,
  };
}

function monter({ utilisateur = compte(), misAJour = true, supprime = true, mouvements = [] } = {}) {
  const utilisateurs = {
    trouverAvecHachageParId: vi.fn().mockResolvedValue(utilisateur),
    mettreAJourMotDePasse: vi.fn().mockResolvedValue(misAJour),
    supprimer: vi.fn().mockResolvedValue(supprime),
  };
  const transactions = {
    listerParUtilisateur: vi.fn().mockResolvedValue(mouvements),
  };
  return { service: creerServiceCompte({ utilisateurs, transactions }), utilisateurs, transactions };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('changement de mot de passe (E7)', () => {
  it('remplace le hachage quand l’ancien mot de passe est correct', async () => {
    const { service, utilisateurs } = monter();

    await service.changerMotDePasse({
      utilisateurId: 7,
      ancienMotDePasse: MOT_DE_PASSE,
      nouveauMotDePasse: NOUVEAU,
    });

    expect(utilisateurs.mettreAJourMotDePasse).toHaveBeenCalledTimes(1);
    const [identifiant, nouveauHachage] = utilisateurs.mettreAJourMotDePasse.mock.calls[0];
    expect(identifiant).toBe(7);
    // Le hachage écrit n'est ni l'ancien, ni le mot de passe en clair, et il valide
    // bien le nouveau mot de passe.
    expect(nouveauHachage).not.toBe(hachage);
    expect(nouveauHachage).not.toContain(NOUVEAU);
    await expect(bcrypt.compare(NOUVEAU, nouveauHachage)).resolves.toBe(true);
    await expect(bcrypt.compare(MOT_DE_PASSE, nouveauHachage)).resolves.toBe(false);
  });

  it('lit le compte par son identifiant, jamais par une donnée du client', async () => {
    const { service, utilisateurs } = monter();

    await service.changerMotDePasse({
      utilisateurId: 7,
      ancienMotDePasse: MOT_DE_PASSE,
      nouveauMotDePasse: NOUVEAU,
    });

    expect(utilisateurs.trouverAvecHachageParId).toHaveBeenCalledWith(7);
  });

  it('refuse un ancien mot de passe incorrect et rattache l’erreur à son champ', async () => {
    const { service, utilisateurs } = monter();

    const echec = await service
      .changerMotDePasse({
        utilisateurId: 7,
        ancienMotDePasse: 'ce-n-est-pas-le-bon',
        nouveauMotDePasse: NOUVEAU,
      })
      .catch((erreur) => erreur);

    expect(echec.statut).toBe(400);
    expect(echec.champs).toEqual([
      { champ: 'ancienMotDePasse', message: 'Ancien mot de passe incorrect.' },
    ]);
    // Rien n'est écrit tant que l'ancien mot de passe n'est pas prouvé.
    expect(utilisateurs.mettreAJourMotDePasse).not.toHaveBeenCalled();
  });

  it('ne divulgue jamais le hachage dans le message d’erreur', async () => {
    const { service } = monter();

    const echec = await service
      .changerMotDePasse({ utilisateurId: 7, ancienMotDePasse: 'faux', nouveauMotDePasse: NOUVEAU })
      .catch((erreur) => erreur);

    expect(echec.message).not.toContain(hachage);
    expect(echec.message).not.toContain('$2b$');
  });

  it('rend 404 quand le porteur du jeton n’a plus de compte', async () => {
    const { service } = monter({ utilisateur: null });

    await expect(
      service.changerMotDePasse({
        utilisateurId: 7,
        ancienMotDePasse: MOT_DE_PASSE,
        nouveauMotDePasse: NOUVEAU,
      })
    ).rejects.toMatchObject({ statut: 404 });
  });
});

describe('suppression du compte (E7)', () => {
  it('supprime le compte du porteur du jeton quand le mot de passe est confirmé', async () => {
    const { service, utilisateurs } = monter();

    await service.supprimer({ utilisateurId: 7, motDePasse: MOT_DE_PASSE });

    expect(utilisateurs.supprimer).toHaveBeenCalledWith(7);
    expect(utilisateurs.supprimer).toHaveBeenCalledTimes(1);
  });

  // La confirmation par mot de passe est une barrière, pas un ornement d'interface :
  // vérifiée ici, elle résiste à un appel direct porteur d'un jeton dérobé.
  it('refuse la suppression et n’efface rien quand le mot de passe est faux', async () => {
    const { service, utilisateurs } = monter();

    const echec = await service
      .supprimer({ utilisateurId: 7, motDePasse: 'ce-n-est-pas-le-bon' })
      .catch((erreur) => erreur);

    expect(echec.statut).toBe(400);
    expect(echec.champs).toEqual([{ champ: 'motDePasse', message: 'Mot de passe incorrect.' }]);
    expect(utilisateurs.supprimer).not.toHaveBeenCalled();
  });

  it('rend 404 quand aucune ligne n’a été supprimée', async () => {
    const { service } = monter({ supprime: false });

    await expect(
      service.supprimer({ utilisateurId: 7, motDePasse: MOT_DE_PASSE })
    ).rejects.toMatchObject({ statut: 404 });
  });

  it('rend 404 quand le porteur du jeton n’a plus de compte', async () => {
    const { service } = monter({ utilisateur: null });

    await expect(
      service.supprimer({ utilisateurId: 7, motDePasse: MOT_DE_PASSE })
    ).rejects.toMatchObject({ statut: 404 });
  });
});

// Deux actifs, mouvements volontairement entrelacés dans le temps : l'export doit les
// rendre dans l'ordre chronologique global, et non actif par actif.
const MOUVEMENTS = [
  {
    id: 1,
    actif_id: 10,
    sens: 'achat',
    quantite: '0.50000000',
    prix_unitaire: '54000.00',
    frais: '12.50',
    date_transaction: '2026-07-15T10:00:00.000Z',
    note: null,
    symbole: 'BTC',
    classe: 'crypto',
  },
  {
    id: 2,
    actif_id: 20,
    sens: 'achat',
    quantite: '10.00000000',
    prix_unitaire: '62.30',
    frais: '0.00',
    date_transaction: '2026-07-20T09:00:00.000Z',
    note: null,
    symbole: 'XAU',
    classe: 'metal',
  },
  {
    id: 3,
    actif_id: 10,
    sens: 'vente',
    quantite: '0.20000000',
    prix_unitaire: '61000.00',
    frais: '8.00',
    date_transaction: '2026-08-02T14:30:00.000Z',
    note: null,
    symbole: 'BTC',
    classe: 'crypto',
  },
];

async function exporter(mouvements) {
  const { service } = monter({ mouvements });
  const { contenu, nomFichier } = await service.exporterMouvements({ utilisateurId: 7 });
  const lignes = contenu.trimEnd().split('\r\n');
  return { contenu, nomFichier, entete: lignes[0], lignes: lignes.slice(1) };
}

describe('export des mouvements (E7, D84)', () => {
  it('rend les huit colonnes attendues, dans l’ordre', async () => {
    const { entete } = await exporter(MOUVEMENTS);

    expect(entete).toBe('date;type;actif;classe;quantite;prix_unitaire;frais;montant');
  });

  it('classe les mouvements de tous les actifs dans l’ordre chronologique', async () => {
    const { lignes } = await exporter(MOUVEMENTS);

    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toContain('2026-07-15');
    expect(lignes[1]).toContain('2026-07-20');
    expect(lignes[2]).toContain('2026-08-02');
    // L'entrelacement est bien respecté : l'or s'intercale entre les deux mouvements
    // de bitcoin plutôt que d'être rendu après eux.
    expect(lignes[1]).toContain('XAU');
  });

  it('écrit les dates en ISO 8601 et les nombres en décimal brut', async () => {
    const { lignes } = await exporter(MOUVEMENTS);

    expect(lignes[0]).toBe('2026-07-15T10:00:00.000Z;achat;BTC;crypto;0.50000000;54000.00;12.50;27000.00');
  });

  it('exporte le montant du moteur, frais exclus (D84)', async () => {
    const { lignes } = await exporter(MOUVEMENTS);

    // 0,5 x 54 000 = 27 000, et les 12,50 de frais restent dans leur propre colonne
    // plutôt que d'être additionnés au montant.
    const champs = lignes[0].split(';');
    expect(champs[6]).toBe('12.50');
    expect(champs[7]).toBe('27000.00');

    // Même règle sur une vente : 0,2 x 61 000 = 12 200, les 8,00 de frais à part.
    const vente = lignes[2].split(';');
    expect(vente[6]).toBe('8.00');
    expect(vente[7]).toBe('12200.00');
  });

  it('rend l’en-tête seul quand le compte n’a aucun mouvement', async () => {
    const { contenu, entete, lignes } = await exporter([]);

    expect(entete).toBe('date;type;actif;classe;quantite;prix_unitaire;frais;montant');
    expect(lignes).toEqual([]);
    expect(contenu).toBe('date;type;actif;classe;quantite;prix_unitaire;frais;montant\r\n');
  });

  it('nomme le fichier avec la date du jour', async () => {
    const { nomFichier } = await exporter(MOUVEMENTS);
    const jour = new Date().toISOString().slice(0, 10);

    expect(nomFichier).toBe(`capitall-mouvements-${jour}.csv`);
  });

  it('ne demande que les mouvements du porteur du jeton', async () => {
    const { service, transactions } = monter({ mouvements: MOUVEMENTS });

    await service.exporterMouvements({ utilisateurId: 7 });

    expect(transactions.listerParUtilisateur).toHaveBeenCalledWith(7);
    expect(transactions.listerParUtilisateur).toHaveBeenCalledTimes(1);
  });

  it('neutralise un symbole qui commencerait comme une formule de tableur', async () => {
    const { lignes } = await exporter([{ ...MOUVEMENTS[0], symbole: '=1+1' }]);

    expect(lignes[0]).toContain(";'=1+1;");
  });
});
