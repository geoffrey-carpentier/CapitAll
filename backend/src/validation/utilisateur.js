// Schémas de validation des entrées d'authentification (D41).
// Deux règles de sécurité gouvernent ces schémas :
//   - le champ role n'apparaît dans aucun schéma d'entrée (D23), un rôle ne s'obtient
//     que par le seed ou une intervention SQL directe ;
//   - .strict() rejette toute clé inconnue plutôt que de l'ignorer silencieusement,
//     ce qui bloque au passage toute tentative d'injecter role dans le corps de requête.

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

// Demande de récupération : l'adresse seule. La réponse est la même que l'adresse
// corresponde ou non à un compte, ce qui interdit d'en faire un outil d'énumération.
const schemaDemandeRecuperation = z.object({ email }).strict();

// Longueur du jeton rendu par le service : trente-deux octets en hexadécimal. Le motif
// refuse tout ce qui n'a pas cette forme avant même d'interroger la base.
const LONGUEUR_JETON_HEXADECIMAL = 64;

const schemaReinitialisation = z
  .object({
    jeton: z
      .string()
      .trim()
      .toLowerCase()
      .length(LONGUEUR_JETON_HEXADECIMAL, 'Cette demande de réinitialisation est invalide.')
      .regex(/^[0-9a-f]+$/, 'Cette demande de réinitialisation est invalide.'),
    // Le nouveau mot de passe obéit à la règle de l'inscription : une réinitialisation
    // ne doit pas être un chemin pour poser un mot de passe plus faible qu'à la création.
    nouveauMotDePasse: motDePasse,
  })
  .strict();

// motDePasse est exporté pour que le changement de mot de passe (validation/compte.js)
// applique exactement la même règle de longueur qu'à l'inscription, sans la recopier.
module.exports = {
  schemaInscription,
  schemaConnexion,
  schemaDemandeRecuperation,
  schemaReinitialisation,
  motDePasse,
};
