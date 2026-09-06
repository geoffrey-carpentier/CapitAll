// Schémas de validation des alertes de seuil (D15, D41).
//
// Ni utilisateur_id ni statut ne figurent dans le schéma de création : le premier vient
// du jeton, le second est fixé par le serveur. .strict() rejette donc toute tentative
// de les fournir dans le corps de la requête.

const { z } = require('zod');
const { versNotationPositionnelle } = require('../utils/decimal');

const TYPES_CIBLE = ['actif', 'capital_total'];
const SENS_SEUIL = ['au_dessus', 'en_dessous'];

// Un seuil se compare soit à un cours, soit à un capital. Le premier descend sous le
// centime et suit donc l'échelle des prix (D88) ; le second est un montant en euros, où
// deux décimales suffisent. La colonne étant commune aux deux, c'est la validation qui
// applique la règle propre à chaque cible : un seuil de capital à dix-huit décimales
// n'aurait aucun sens, et un seuil de cours à deux rendait impossible toute surveillance
// d'un actif coté sous le centime.
const DECIMALES_SEUIL_ACTIF = 18;
const DECIMALES_SEUIL_CAPITAL = 2;
const CHIFFRES_SEUIL = 12;

// Le seuil est normalisé en chaîne et transmis tel quel à la colonne NUMERIC : le
// convertir en nombre réintroduirait l'imprécision que le projet écarte partout (D4).
// La notation scientifique est ramenée en écriture positionnelle, JSON.parse rendant un
// nombre que JavaScript écrit en exposant sous 1e-6.
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
  })
  // La précision admise dépend de la cible. Un seuil de capital au millième d'euro
  // n'est pas une exigence de précision mais une erreur de saisie : l'accepter
  // laisserait croire à une surveillance plus fine que ce que le patrimoine permet.
  .refine(
    (donnees) =>
      donnees.type_cible !== 'capital_total' ||
      new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_SEUIL_CAPITAL}})?$`).test(donnees.valeur_seuil),
    {
      message: `Un seuil sur le capital comporte au plus ${DECIMALES_SEUIL_CAPITAL} décimales.`,
      path: ['valeur_seuil'],
    }
  );

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
