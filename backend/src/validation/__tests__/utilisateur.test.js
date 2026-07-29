// Les fichiers de test sont écrits en modules ES : Vitest refuse d'être chargé par
// require(). Le code de production reste en CommonJS, Vite assurant l'interopérabilité.

import { describe, it, expect } from 'vitest';
import { schemaInscription, schemaConnexion } from '../utilisateur.js';

describe("schéma d'inscription", () => {
  const inscriptionValide = {
    email: 'camille@example.fr',
    motDePasse: 'motdepasse-solide',
    pseudo: 'Camille',
  };

  it('accepte une inscription complète', () => {
    expect(schemaInscription.safeParse(inscriptionValide).success).toBe(true);
  });

  it('accepte une inscription sans pseudo', () => {
    const { pseudo, ...sansPseudo } = inscriptionValide;
    expect(schemaInscription.safeParse(sansPseudo).success).toBe(true);
  });

  it("normalise l'email en minuscules et retire les espaces", () => {
    const resultat = schemaInscription.parse({
      ...inscriptionValide,
      email: '  Camille@Example.FR  ',
    });
    expect(resultat.email).toBe('camille@example.fr');
  });

  it('rejette un email au format invalide', () => {
    expect(schemaInscription.safeParse({ ...inscriptionValide, email: 'pas-un-email' }).success).toBe(
      false
    );
  });

  it('rejette un mot de passe de moins de 10 caractères', () => {
    expect(schemaInscription.safeParse({ ...inscriptionValide, motDePasse: 'court' }).success).toBe(
      false
    );
  });

  // Test de la règle D23 : un rôle ne s'obtient jamais par une entrée utilisateur.
  it('rejette un champ role injecté dans le corps de la requête', () => {
    const resultat = schemaInscription.safeParse({ ...inscriptionValide, role: 'admin' });
    expect(resultat.success).toBe(false);
    expect(resultat.error.issues[0].code).toBe('unrecognized_keys');
  });

  it('ne laisse jamais passer role dans les données validées', () => {
    const resultat = schemaInscription.safeParse({ ...inscriptionValide, role: 'admin' });
    expect(resultat.data).toBeUndefined();
  });

  it('rejette toute clé inconnue', () => {
    expect(schemaInscription.safeParse({ ...inscriptionValide, actif: true }).success).toBe(false);
  });
});

describe('schéma de connexion', () => {
  const connexionValide = { email: 'camille@example.fr', motDePasse: 'motdepasse-solide' };

  it('accepte des identifiants bien formés', () => {
    expect(schemaConnexion.safeParse(connexionValide).success).toBe(true);
  });

  // La règle de longueur ne s'applique qu'à l'inscription : un compte créé avant un
  // durcissement doit continuer à pouvoir se connecter.
  it('accepte un mot de passe court à la connexion', () => {
    expect(schemaConnexion.safeParse({ ...connexionValide, motDePasse: 'abc' }).success).toBe(true);
  });

  it('rejette un mot de passe vide', () => {
    expect(schemaConnexion.safeParse({ ...connexionValide, motDePasse: '' }).success).toBe(false);
  });

  it('rejette un champ role injecté', () => {
    expect(schemaConnexion.safeParse({ ...connexionValide, role: 'admin' }).success).toBe(false);
  });
});
