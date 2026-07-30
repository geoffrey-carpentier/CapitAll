// Schémas de validation des alertes de seuil (D15, D41).
//
// Ni utilisateur_id ni statut ne figurent dans le schéma de création : le premier vient
// du jeton, le second est fixé par le serveur. .strict() rejette donc toute tentative
// de les fournir dans le corps de la requête.

const { z } = require('zod');

const TYPES_CIBLE = ['actif', 'capital_total'];
const SENS_SEUIL = ['au_dessus', 'en_dessous'];

const DECIMALES_SEUIL = 2;

// Le seuil est normalisé en chaîne et transmis tel quel à la colonne NUMERIC : le
// convertir en nombre réintroduirait l'imprécision que le projet écarte partout (D4).
const valeurSeuil = z
  .union([z.string(), z.number()])
  .transform((valeur) => String(valeur).trim())
  .refine((valeur) => new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_SEUIL}})?$`).test(valeur), {
    message: `Le seuil doit être positif et comporter au plus ${DECIMALES_SEUIL} décimales.`,
  })
  .refine((valeur) => Number(valeur) > 0, {
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
  // Reprise fidèle de la contrainte CHECK du schéma : actif_id est renseigné si et
  // seulement si la cible est un actif. Détecter le cas ici plutôt que de laisser
  // PostgreSQL rejeter l'insertion permet de rendre un message compréhensible, et
  // évite d'exposer une erreur de contrainte brute à l'utilisateur.
  .refine((donnees) => donnees.type_cible !== 'actif' || donnees.actif_id !== undefined, {
    message: "Une alerte ciblant un actif doit préciser l'actif concerné.",
    path: ['actif_id'],
  })
  .refine((donnees) => donnees.type_cible !== 'capital_total' || donnees.actif_id === undefined, {
    message: "Une alerte sur le capital total ne cible aucun actif en particulier.",
    path: ['actif_id'],
  });

// Seule la désactivation est exposée. La contrainte CHECK du schéma autorise aussi le
// retour au statut 'active', mais réactiver une alerte déjà déclenchée poserait la
// question de sa date de déclenchement : le cas n'est pas au périmètre du MVP et
// l'API ne l'ouvre donc pas, plutôt que de laisser passer un comportement non défini.
const modificationAlerte = z
  .object({
    statut: z.literal('desactivee', 'Seule la désactivation est possible.'),
  })
  .strict();

module.exports = { creationAlerte, modificationAlerte, TYPES_CIBLE, SENS_SEUIL };
