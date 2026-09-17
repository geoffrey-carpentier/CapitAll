// Schémas de validation de la gestion du compte. La règle du nouveau mot de passe est
// importée de l'inscription plutôt que recopiée.

const { z } = require('zod');
const { motDePasse } = require('./utilisateur');

// L'ancien mot de passe n'est contrôlé que sur sa présence : une règle durcie depuis ne
// doit pas empêcher de changer un mot de passe devenu trop court.
const schemaChangementMotDePasse = z
  .object({
    // Message aussi sur z.string, sinon une clé absente produit le message anglais par
    // défaut.
    ancienMotDePasse: z
      .string("L'ancien mot de passe est obligatoire.")
      .min(1, "L'ancien mot de passe est obligatoire."),
    nouveauMotDePasse: motDePasse,
  })
  .strict()
  .refine((donnees) => donnees.ancienMotDePasse !== donnees.nouveauMotDePasse, {
    message: 'Le nouveau mot de passe doit être différent de l\'ancien.',
    path: ['nouveauMotDePasse'],
  });

// La suppression exige le mot de passe, vérifié par le serveur : un jeton dérobé ne doit
// pas suffire.
const schemaSuppressionCompte = z
  .object({
    motDePasse: z
      .string('Le mot de passe est obligatoire.')
      .min(1, 'Le mot de passe est obligatoire.'),
  })
  .strict();

module.exports = { schemaChangementMotDePasse, schemaSuppressionCompte };
