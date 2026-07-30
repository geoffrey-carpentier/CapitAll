import { describe, it, expect } from 'vitest';
import { creationAlerte, modificationAlerte } from '../alerte.js';

const ALERTE_ACTIF = {
  type_cible: 'actif',
  sens_seuil: 'au_dessus',
  valeur_seuil: '70000.00',
  actif_id: 1,
};

const ALERTE_CAPITAL = {
  type_cible: 'capital_total',
  sens_seuil: 'en_dessous',
  valeur_seuil: '45000.00',
};

describe("schéma de création d'une alerte", () => {
  it('accepte une alerte sur un actif', () => {
    expect(creationAlerte.safeParse(ALERTE_ACTIF).success).toBe(true);
  });

  it('accepte une alerte sur le capital total', () => {
    expect(creationAlerte.safeParse(ALERTE_CAPITAL).success).toBe(true);
  });

  // Reprise de la contrainte CHECK du schéma : actif_id est renseigné si et seulement
  // si la cible est un actif. Le contrôler ici permet un message compréhensible plutôt
  // qu'une erreur de contrainte brute remontée par PostgreSQL.
  it("rejette une alerte sur actif sans actif_id", () => {
    const { actif_id, ...sansActif } = ALERTE_ACTIF;
    const resultat = creationAlerte.safeParse(sansActif);

    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].message).toMatch(/préciser l'actif/);
  });

  it("rejette une alerte sur le capital total accompagnée d'un actif_id", () => {
    const resultat = creationAlerte.safeParse({ ...ALERTE_CAPITAL, actif_id: 1 });

    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].message).toMatch(/aucun actif/);
  });

  it('rejette un seuil nul', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, valeur_seuil: '0' }).success).toBe(false);
  });

  it('rejette un seuil négatif', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, valeur_seuil: '-10.00' }).success).toBe(false);
  });

  it('rejette un seuil à plus de deux décimales', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, valeur_seuil: '70000.123' }).success).toBe(
      false
    );
  });

  it('conserve le seuil en chaîne, sans conversion en flottant', () => {
    const resultat = creationAlerte.parse({ ...ALERTE_ACTIF, valeur_seuil: 70000.5 });
    expect(resultat.valeur_seuil).toBe('70000.5');
    expect(typeof resultat.valeur_seuil).toBe('string');
  });

  it('rejette une cible hors liste', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, type_cible: 'devise' }).success).toBe(false);
  });

  it('rejette un sens hors liste', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, sens_seuil: 'egal' }).success).toBe(false);
  });

  // Le statut est fixé par le serveur, le propriétaire vient du jeton : ni l'un ni
  // l'autre n'est accepté depuis le corps de la requête.
  it('rejette un statut ou un utilisateur_id injecté', () => {
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, statut: 'declenchee' }).success).toBe(false);
    expect(creationAlerte.safeParse({ ...ALERTE_ACTIF, utilisateur_id: 1 }).success).toBe(false);
  });
});

describe("schéma de modification d'une alerte", () => {
  it('accepte la désactivation', () => {
    expect(modificationAlerte.safeParse({ statut: 'desactivee' }).success).toBe(true);
  });

  // La réactivation n'est pas au périmètre : elle poserait la question de la date de
  // déclenchement d'une alerte déjà franchie.
  it('rejette une réactivation', () => {
    expect(modificationAlerte.safeParse({ statut: 'active' }).success).toBe(false);
  });

  it('rejette un statut arbitraire', () => {
    expect(modificationAlerte.safeParse({ statut: 'archivee' }).success).toBe(false);
  });

  it('rejette toute clé inconnue', () => {
    expect(
      modificationAlerte.safeParse({ statut: 'desactivee', valeur_seuil: '1.00' }).success
    ).toBe(false);
  });
});
