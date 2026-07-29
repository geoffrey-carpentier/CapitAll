// Schémas de validation des actifs (D41).
// Ni utilisateur_id ni id ne figurent dans ces schémas : le propriétaire vient du jeton
// et l'identifiant de l'URL. .strict() rejette donc toute tentative de les fournir
// dans le corps de la requête.

const { z } = require('zod');

// Les quatre types du CHECK de la table actif, ni plus ni moins.
const TYPES_ACTIF = ['crypto', 'devise', 'metal', 'action'];

const LONGUEUR_MAXIMALE_SYMBOLE = 20;
const LONGUEUR_MAXIMALE_NOM = 100;

const symbole = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Le symbole est obligatoire.')
  .max(LONGUEUR_MAXIMALE_SYMBOLE, `Le symbole ne peut pas dépasser ${LONGUEUR_MAXIMALE_SYMBOLE} caractères.`)
  .regex(/^[A-Z0-9]+$/, 'Le symbole ne peut contenir que des lettres et des chiffres.');

const nom = z
  .string()
  .trim()
  .min(1, 'Le nom est obligatoire.')
  .max(LONGUEUR_MAXIMALE_NOM, `Le nom ne peut pas dépasser ${LONGUEUR_MAXIMALE_NOM} caractères.`);

const creationActif = z
  .object({
    type: z.enum(TYPES_ACTIF, "Le type doit valoir crypto, devise, metal ou action."),
    symbole,
    nom,
  })
  .strict();

module.exports = { creationActif, TYPES_ACTIF };
