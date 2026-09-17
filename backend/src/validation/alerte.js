// Schémas de validation des alertes de seuil. utilisateur_id (jeton) et statut (fixé par
// le serveur) n'y figurent pas : .strict() refuse de les recevoir dans le corps.

const { z } = require('zod');
const { versNotationPositionnelle } = require('../utils/decimal');

const TYPES_CIBLE = ['actif', 'capital_total'];
const SENS_SEUIL = ['au_dessus', 'en_dessous'];

// La colonne est commune, mais la précision dépend de la cible : échelle des prix pour
// un cours (sous le centime possible), deux décimales pour un capital en euros.
const DECIMALES_SEUIL_ACTIF = 18;
const DECIMALES_SEUIL_CAPITAL = 2;
const CHIFFRES_SEUIL = 12;

// Seuil normalisé en chaîne pour la colonne NUMERIC, sans passer par un flottant. Un
// nombre JSON sous 1e-6 arrive en notation scientifique : il est remis en positionnel.
const valeurSeuil = z
  .union([z.string(), z.number()])
  .transform((valeur) => versNotationPositionnelle(String(valeur).trim()))
  .refine(
    (valeur) =>
      new RegExp(`^\\d{1,${CHIFFRES_SEUIL}}(\\.\\d{1,${DECIMALES_SEUIL_ACTIF}})?$`).test(valeur),
    {
      message:
        `Le seuil doit être positif, comporter au plus ${DECIMALES_SEUIL_ACTIF} décimales ` +
        `et ${CHIFFRES_SEUIL} chiffres avant la virgule.`,
    }
  )
  .refine((valeur) => /[1-9]/.test(valeur), {
    message: 'Le seuil doit être strictement positif.',
  });

const creationAlerte = z
  .object({
    type_cible: z.enum(TYPES_CIBLE, 'La cible doit valoir actif ou capital_total.'),
    sens_seuil: z.enum(SENS_SEUIL, 'Le sens doit valoir au_dessus ou en_dessous.'),
    valeur_seuil: valeurSeuil,
    actif_id: z.int().positive("L'identifiant d'actif est invalide.").optional(),
  })
  .strict()
  // Reprend la contrainte CHECK du schéma (actif_id si et seulement si la cible est un
  // actif), pour rendre un message clair plutôt qu'une erreur de contrainte.
  .refine((donnees) => donnees.type_cible !== 'actif' || donnees.actif_id !== undefined, {
    message: "Une alerte ciblant un actif doit préciser l'actif concerné.",
    path: ['actif_id'],
  })
  .refine((donnees) => donnees.type_cible !== 'capital_total' || donnees.actif_id === undefined, {
    message: "Une alerte sur le capital total ne cible aucun actif en particulier.",
    path: ['actif_id'],
  })
  // Un seuil de capital au-delà du centime est une erreur de saisie.
  .refine(
    (donnees) =>
      donnees.type_cible !== 'capital_total' ||
      new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_SEUIL_CAPITAL}})?$`).test(donnees.valeur_seuil),
    {
      message: `Un seuil sur le capital comporte au plus ${DECIMALES_SEUIL_CAPITAL} décimales.`,
      path: ['valeur_seuil'],
    }
  );

// Seule la désactivation est exposée : la réactivation (que le schéma permettrait) est
// hors périmètre, le sort de la date de déclenchement n'étant pas défini.
const modificationAlerte = z
  .object({
    statut: z.literal('desactivee', 'Seule la désactivation est possible.'),
  })
  .strict();

module.exports = { creationAlerte, modificationAlerte, TYPES_CIBLE, SENS_SEUIL };
