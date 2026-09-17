// Schémas de validation des entrées d'authentification.
//   - role n'apparaît dans aucun schéma : un rôle ne s'obtient que par le seed ou en SQL ;
//   - .strict() rejette toute clé inconnue, donc toute tentative d'injecter role.

const { z } = require('zod');

const LONGUEUR_MAXIMALE_EMAIL = 255;
const LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;
const LONGUEUR_MAXIMALE_MOT_DE_PASSE = 128;
const LONGUEUR_MAXIMALE_PSEUDO = 100;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(LONGUEUR_MAXIMALE_EMAIL, `L'email ne peut pas dépasser ${LONGUEUR_MAXIMALE_EMAIL} caractères.`)
  .pipe(z.email("Le format de l'email est invalide."));

const motDePasse = z
  .string()
  .min(
    LONGUEUR_MINIMALE_MOT_DE_PASSE,
    `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`
  )
  .max(LONGUEUR_MAXIMALE_MOT_DE_PASSE);

const schemaInscription = z
  .object({
    email,
    motDePasse,
    pseudo: z.string().trim().min(1).max(LONGUEUR_MAXIMALE_PSEUDO).optional(),
  })
  .strict();

// La connexion ne contrôle pas la longueur du mot de passe : une règle durcie plus tard
// ne doit pas empêcher un compte existant de se connecter.
const schemaConnexion = z
  .object({
    email,
    motDePasse: z.string().min(1, 'Le mot de passe est obligatoire.'),
  })
  .strict();

// Demande de récupération : l'adresse seule.
const schemaDemandeRecuperation = z.object({ email }).strict();

// Jeton de 32 octets en hexadécimal : toute autre forme est refusée avant la base.
const LONGUEUR_JETON_HEXADECIMAL = 64;

const schemaReinitialisation = z
  .object({
    jeton: z
      .string()
      .trim()
      .toLowerCase()
      .length(LONGUEUR_JETON_HEXADECIMAL, 'Cette demande de réinitialisation est invalide.')
      .regex(/^[0-9a-f]+$/, 'Cette demande de réinitialisation est invalide.'),
    // Même règle qu'à l'inscription.
    nouveauMotDePasse: motDePasse,
  })
  .strict();

// motDePasse est réutilisé par validation/compte.js, sans recopier la règle.
module.exports = {
  schemaInscription,
  schemaConnexion,
  schemaDemandeRecuperation,
  schemaReinitialisation,
  motDePasse,
};
