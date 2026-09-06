import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

// Contrats de route, contre l'application réellement montée (QA-01, S-19).
//
// Ce que les tests de service ne peuvent pas établir : qu'une route existe à l'adresse
// annoncée, qu'elle est bien derrière l'authentification, et que le verbe compte. Une
// fonction peut être juste et n'être branchée nulle part — c'est exactement le défaut
// que l'audit relevait sur `PATCH /api/actifs/:id`.
//
// L'application est montée en mémoire, sans écouter de port : supertest ouvre un socket
// éphémère par requête. Rien n'est publié, rien n'est laissé ouvert.
//
// Environnement : docker-compose.test.yml, base isolée, port 5434.
//
//   docker compose -p walletwatch-test -f docker-compose.test.yml up -d
//   npm run test:integration
const URL_BASE_DE_TEST =
  process.env.DATABASE_URL_TEST ??
  'postgresql://walletwatch_test:test_sans_equivalent_reel@127.0.0.1:5434/walletwatch_test';

// Valeur de test, sans équivalent réel : elle ne signe que les jetons de ce fichier.
const SECRET_DE_TEST = 'secret_de_test_sans_equivalent_reel_32';

let pool;
let app;
let emettreJeton;
let titulaire;
let tiers;
let actifDuTiers;

async function creerCompte(prefixe) {
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo)
     VALUES ($1, 'sans-objet-pour-ce-test', $2) RETURNING id, role`,
    [`${prefixe}-${Date.now()}-${Math.random().toString(16).slice(2)}@exemple.test`, prefixe]
  );
  return rows[0];
}

beforeAll(async () => {
  process.env.DATABASE_URL = URL_BASE_DE_TEST;
  process.env.JWT_SECRET = SECRET_DE_TEST;
  // Le cache n'a rien à faire ici : les cours ne sont pas l'objet de ces contrôles, et
  // une adresse injoignable est absorbée par le client Redis, qui se replie en silence.
  process.env.REDIS_URL = 'redis://127.0.0.1:6399';

  ({ pool } = await import('../../../db/index.js'));
  ({ default: app } = await import('../../../app.js'));
  ({ emettreJeton } = await import('../../authentification.js'));
});

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  titulaire = await creerCompte('titulaire');
  tiers = await creerCompte('tiers');

  const { rows } = await pool.query(
    `INSERT INTO actif (utilisateur_id, type, symbole, nom)
     VALUES ($1, 'crypto', 'BTC', 'Bitcoin') RETURNING id`,
    [tiers.id]
  );
  actifDuTiers = rows[0].id;
});

function jetonDe(compte) {
  return emettreJeton({ id: compte.id, role: compte.role });
}

describe('routes du portefeuille', () => {
  it('refuse une lecture sans jeton', async () => {
    const reponse = await request(app).get('/api/portefeuille');
    expect(reponse.status).toBe(401);
  });

  it('refuse une lecture avec un jeton signé par une autre clé', async () => {
    // Un jeton bien formé mais signé ailleurs doit valoir un jeton absent.
    const contrefait = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOjEsInJvbGUiOiJ1dGlsaXNhdGV1ciIsImlhdCI6MTc4ODY1MzYyMX0',
      'signature_qui_ne_correspond_a_rien',
    ].join('.');

    const reponse = await request(app)
      .get('/api/portefeuille')
      .set('Authorization', `Bearer ${contrefait}`);

    expect(reponse.status).toBe(401);
  });

  it('rend le portefeuille d’un compte authentifié', async () => {
    const reponse = await request(app)
      .get('/api/portefeuille')
      .set('Authorization', `Bearer ${jetonDe(titulaire)}`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.actifs).toEqual([]);
    expect(reponse.body.capital_complet).toBe(true);
  });

  it('expose l’actualisation en POST, et seulement en POST', async () => {
    const jeton = `Bearer ${jetonDe(titulaire)}`;

    const commande = await request(app)
      .post('/api/portefeuille/actualisation')
      .set('Authorization', jeton);
    expect(commande.status).toBe(200);

    // Le verbe fait partie du contrat : c'est lui qui empêche un préchargeur ou un
    // rechargement de rejouer une écriture.
    const enLecture = await request(app)
      .get('/api/portefeuille/actualisation')
      .set('Authorization', jeton);
    expect(enLecture.status).toBe(404);
  });

  it('protège l’actualisation par l’authentification, comme la lecture', async () => {
    const reponse = await request(app).post('/api/portefeuille/actualisation');
    expect(reponse.status).toBe(401);
  });

  it('refuse un paramètre de fenêtre invalide en 400, jamais en 500', async () => {
    const reponse = await request(app)
      .get('/api/portefeuille/historique?jours=beaucoup')
      .set('Authorization', `Bearer ${jetonDe(titulaire)}`);

    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur).toMatch(/jours/);
  });
});

describe('cloisonnement des comptes', () => {
  it('rend 404, et non 403, sur la position d’un autre compte', async () => {
    // D52 : l'appelant ne doit pas pouvoir distinguer l'inexistant de ce qui ne lui
    // appartient pas, sans quoi un balayage d'identifiants énumérerait les ressources
    // des autres comptes.
    const reponse = await request(app)
      .get(`/api/actifs/${actifDuTiers}`)
      .set('Authorization', `Bearer ${jetonDe(titulaire)}`);

    expect(reponse.status).toBe(404);
  });

  it('rend la même chose sur un identifiant qui n’existe pas', async () => {
    const reponse = await request(app)
      .get('/api/actifs/999999999')
      .set('Authorization', `Bearer ${jetonDe(titulaire)}`);

    expect(reponse.status).toBe(404);
  });

  it('n’expose aucun portefeuille sur une adresse inconnue', async () => {
    const reponse = await request(app)
      .get('/api/portefeuille/inconnu')
      .set('Authorization', `Bearer ${jetonDe(titulaire)}`);

    expect(reponse.status).toBe(404);
  });
});

describe('santé et surface publique', () => {
  it('rend la sonde de santé sans authentification', async () => {
    // Le contrôle de santé du conteneur l'interroge sans jeton : le protéger arrêterait
    // le déploiement.
    const reponse = await request(app).get('/api/sante');

    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ statut: 'ok' });
  });
});
