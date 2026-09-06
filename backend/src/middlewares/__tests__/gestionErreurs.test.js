import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// Le gestionnaire trie les erreurs avec instanceof, ce qui exige que les classes du
// test soient exactement celles qu'il voit lui-même. Les sources étant en CommonJS, les
// charger ici par import ES donnerait deux jeux de classes distincts et toute erreur
// métier tomberait dans la branche des erreurs inattendues. Le require natif place les
// deux modules dans le même cache, comme à l'exécution réelle du serveur.
const require = createRequire(import.meta.url);
const gestionErreurs = require('../gestionErreurs.js');
const { ErreurValidation, ErreurIntrouvable, ErreurAuthentification } = require('../../erreurs.js');

// Même doublure de réponse que les autres tests de middleware : le gestionnaire n'a
// besoin que de status() et json() pour être exercé.
function creerReponse() {
  return {
    statut: null,
    corps: null,
    status(code) {
      this.statut = code;
      return this;
    },
    json(donnees) {
      this.corps = donnees;
      return this;
    },
  };
}

const requete = { method: 'PATCH', originalUrl: '/api/compte/mot-de-passe', path: '/api/compte/mot-de-passe' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('traduction des erreurs métier', () => {
  it('rend le statut et le message de l’erreur', () => {
    const res = creerReponse();

    gestionErreurs(new ErreurIntrouvable('Actif introuvable.'), requete, res, vi.fn());

    expect(res.statut).toBe(404);
    expect(res.corps).toEqual({ erreur: 'Actif introuvable.' });
  });

  // Non-régression : les erreurs qui ne portent pas de détail par champ doivent rendre
  // exactement le même corps qu'avant l'ajout de ce détail.
  it('n’ajoute aucune clé champs quand l’erreur n’en porte pas', () => {
    const res = creerReponse();

    gestionErreurs(new ErreurAuthentification('Email ou mot de passe incorrect.'), requete, res, vi.fn());

    expect(res.statut).toBe(401);
    expect(Object.keys(res.corps)).toEqual(['erreur']);
  });

  it('transmet le détail par champ quand l’erreur en porte un', () => {
    const res = creerReponse();
    const champs = [{ champ: 'ancienMotDePasse', message: 'Ancien mot de passe incorrect.' }];

    gestionErreurs(new ErreurValidation('Ancien mot de passe incorrect.', champs), requete, res, vi.fn());

    expect(res.statut).toBe(400);
    expect(res.corps).toEqual({ erreur: 'Ancien mot de passe incorrect.', champs });
  });

  it('rend une erreur de validation sans détail quand aucun champ n’est précisé', () => {
    const res = creerReponse();

    gestionErreurs(new ErreurValidation('Données invalides.'), requete, res, vi.fn());

    expect(res.corps).toEqual({ erreur: 'Données invalides.' });
  });
});

describe('erreurs inattendues', () => {
  // Le client ne doit jamais recevoir le détail technique : ni la pile, ni le message
  // d'origine, qui renseigneraient sur la structure interne de l'application.
  it('masque le détail d’une erreur non métier derrière un message générique', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = creerReponse();

    gestionErreurs(new Error('relation "utilisateur" does not exist'), requete, res, vi.fn());

    expect(res.statut).toBe(500);
    expect(res.corps).toEqual({ erreur: 'Une erreur interne est survenue.' });
  });
});

// Ce que le journal du serveur ne doit pas contenir.
//
// Le gestionnaire est le seul endroit du back-end qui journalise une erreur inattendue :
// c'est donc ici, et nulle part ailleurs, que se joue ce qui finit dans les journaux.
describe('ce qui part au journal', () => {
  function capturer(erreur, req = requete) {
    const lignes = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => lignes.push(args.join(' ')));
    gestionErreurs(erreur, req, creerReponse(), vi.fn());
    return lignes.join(' | ');
  }

  it('ne recopie pas la chaîne de requête', () => {
    // Elle porte des valeurs saisies par l'appelant. Le chemin suffit à situer
    // l'incident, et c'est tout ce qu'on en attend.
    const avecParametres = {
      method: 'GET',
      path: '/api/portefeuille/historique',
      originalUrl: '/api/portefeuille/historique?jours=30&trace=valeur-saisie',
    };

    const journal = capturer(new Error('échec'), avecParametres);

    expect(journal).toContain('/api/portefeuille/historique');
    expect(journal).not.toContain('valeur-saisie');
    expect(journal).not.toContain('jours=30');
  });

  it("ne recopie pas le détail d'une erreur PostgreSQL", () => {
    // Une violation d'unicité rend un `detail` de la forme
    // « Key (email)=(camille@exemple.test) already exists ». Journaliser l'objet entier
    // déposait donc une adresse d'utilisateur dans les journaux à chaque conflit.
    const erreurSql = new Error('duplicate key value violates unique constraint');
    erreurSql.code = '23505';
    erreurSql.detail = 'Key (email)=(camille@exemple.test) already exists.';
    erreurSql.where = 'SQL statement "INSERT INTO utilisateur ..."';

    const journal = capturer(erreurSql);

    expect(journal).toContain('duplicate key value');
    expect(journal).not.toContain('camille@exemple.test');
    expect(journal).not.toContain('INSERT INTO utilisateur');
  });

  it('conserve de quoi diagnostiquer', () => {
    // Expurger n'est pas taire : sans le message ni la pile, l'incident deviendrait
    // introuvable.
    const journal = capturer(new TypeError('lecture de undefined'));

    expect(journal).toContain('TypeError');
    expect(journal).toContain('lecture de undefined');
    expect(journal).toContain('PATCH');
  });
});
