import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// Limitation de débit sur les chemins d'authentification (S-15).
//
// Ces tests montent une application Express réelle et lui envoient de vraies requêtes :
// un compteur de quota vit dans un intergiciel, il n'a pas d'existence observable
// ailleurs. Supertest écoute sur un port éphémère, aucune base n'est touchée.
//
// Ce qui est vérifié tient en trois points, tous conséquences directes de la mesure
// d'adresse cliente du 05/09 : le compteur suit l'adresse électronique et non l'IP,
// deux comptes ne se gênent pas, et une connexion réussie ne consomme rien.

let quota;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://utilisateur:secret@localhost:5432/walletwatch';
  process.env.JWT_SECRET = 'd'.repeat(32);
  quota = await import('../quota.js');
});

// Application minimale : le quota, puis une route qui échoue ou réussit sur commande.
// Le service d'authentification n'entre pas en jeu, c'est bien le compteur qu'on mesure.
function monter(limiteur) {
  const app = express();
  app.use(express.json());
  app.post('/essai', limiteur, (req, res) => {
    if (req.body?.reussir) {
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
  });
  return app;
}

async function tenter(app, corps) {
  return request(app).post('/essai').send(corps);
}

// Les limiteurs sont des instances de module : leurs compteurs survivent d'un test à
// l'autre. Chaque test travaille donc sur une adresse qui n'appartient qu'à lui, ce qui
// le rend indépendant de l'ordre d'exécution sans avoir à vider un état partagé.
let numero = 0;
function adresse() {
  numero += 1;
  return `essai-${numero}@exemple.test`;
}

describe('quota de connexion', () => {
  it('bloque après le nombre d’échecs prévu, et pas avant', async () => {
    const app = monter(quota.quotaConnexion);
    const corps = { email: adresse() };

    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE; essai += 1) {
      const reponse = await tenter(app, corps);
      expect(reponse.status).toBe(401);
    }

    const bloquee = await tenter(app, corps);
    expect(bloquee.status).toBe(429);
    expect(bloquee.body.erreur).toMatch(/Trop de tentatives/);
  });

  it('compte par adresse électronique, pas par client', async () => {
    // C'est la conclusion de la mesure du 05/09 : sur ce déploiement, req.ip vaut la
    // même valeur pour tout le monde. Un quota par IP y compterait le monde entier sur
    // un compteur unique.
    const app = monter(quota.quotaConnexion);
    const premier = adresse();
    const second = adresse();

    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE; essai += 1) {
      await tenter(app, { email: premier });
    }

    expect((await tenter(app, { email: premier })).status).toBe(429);
    // Le second compte n'est pas gêné, alors que les deux appels viennent de la même
    // adresse réseau.
    expect((await tenter(app, { email: second })).status).toBe(401);
  });

  it('traite deux graphies d’une même adresse comme un seul compteur', async () => {
    const app = monter(quota.quotaConnexion);
    const minuscules = adresse();
    const majuscules = minuscules.toUpperCase();

    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE; essai += 1) {
      await tenter(app, { email: majuscules });
    }

    // La validation normalise l'adresse : le compteur doit la normaliser de la même
    // façon, sans quoi la casse suffirait à repartir de zéro.
    expect((await tenter(app, { email: minuscules })).status).toBe(429);
  });

  it('efface les échecs d’un tiers dès que le titulaire se connecte', async () => {
    // C'est ce qui empêche un tiers de gêner durablement le titulaire d'un compte : il
    // épuise des tentatives, la connexion légitime qui suit remet le compteur à zéro et
    // le titulaire retrouve toute sa marge.
    const app = monter(quota.quotaConnexion);
    const email = adresse();

    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE - 1; essai += 1) {
      expect((await tenter(app, { email })).status).toBe(401);
    }

    // La connexion réussie du titulaire, suivie de la remise à zéro que fait le
    // contrôleur.
    expect((await tenter(app, { email, reussir: true })).status).toBe(200);
    quota.reinitialiserQuotaConnexion(email);

    // Le compte repart avec la totalité de ses tentatives, et non avec la seule qui
    // restait.
    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE; essai += 1) {
      expect((await tenter(app, { email })).status).toBe(401);
    }
    expect((await tenter(app, { email })).status).toBe(429);
  });

  it('ignore une remise à zéro sans adresse', async () => {
    expect(() => quota.reinitialiserQuotaConnexion(undefined)).not.toThrow();
    expect(() => quota.reinitialiserQuotaConnexion('   ')).not.toThrow();
  });

  it('ne laisse pas un corps sans adresse contourner le compteur', async () => {
    // Une clé propre par requête malformée offrirait un contournement gratuit. La clé
    // commune étant partagée, elle est vidée avant de compter.
    const app = monter(quota.quotaConnexion);
    quota.quotaConnexion.resetKey('sans-adresse');

    for (let essai = 0; essai < quota.ECHECS_AVANT_BLOCAGE; essai += 1) {
      await tenter(app, {});
    }

    expect((await tenter(app, {})).status).toBe(429);
  });

  it('annonce le quota par les en-têtes normalisés', async () => {
    const app = monter(quota.quotaConnexion);

    const reponse = await tenter(app, { email: adresse() });

    expect(reponse.headers['ratelimit-policy']).toBeDefined();
    // Les en-têtes hérités X-RateLimit-* sont désactivés : deux jeux d'en-têtes disant
    // la même chose sont une source de divergence, pas une compatibilité.
    expect(reponse.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('quota de demande de réinitialisation', () => {
  it('plafonne les demandes elles-mêmes, réussies comprises', async () => {
    // Une demande de réinitialisation réussit toujours du point de vue HTTP, puisqu'elle
    // rend la même réponse que l'adresse existe ou non : ne compter que les échecs ne
    // plafonnerait rien du tout.
    const app = monter(quota.quotaDemandeRecuperation);
    const corps = { email: adresse(), reussir: true };

    for (let essai = 0; essai < quota.DEMANDES_AVANT_BLOCAGE; essai += 1) {
      expect((await tenter(app, corps)).status).toBe(200);
    }

    expect((await tenter(app, corps)).status).toBe(429);
  });

  it('reste plus bas que le quota de connexion', async () => {
    // Demander une réinitialisation est un geste rare ; se tromper de mot de passe l'est
    // beaucoup moins.
    expect(quota.DEMANDES_AVANT_BLOCAGE).toBeLessThan(quota.ECHECS_AVANT_BLOCAGE);
  });
});
