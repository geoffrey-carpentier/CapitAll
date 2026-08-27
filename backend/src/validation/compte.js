// Schémas de validation des entrées de gestion du compte (D41).
//
// La règle de longueur du nouveau mot de passe est celle de l'inscription, importée
// plutôt que recopiée : durcir la règle un jour ne doit pas laisser une des deux
// portes ouverte sur l'ancienne.

const { z } = require('zod');
const { motDePasse } = require('./utilisateur');

// L'ancien mot de passe n'est contrôlé que sur sa présence. Lui appliquer la règle de
// longueur courante empêcherait un compte créé sous une règle plus permissive de
// changer précisément le mot de passe devenu trop court.
const schemaChangementMotDePasse = z
  .object({
    // Le message est donné à z.string autant qu'à min : sans lui, une clé absente
    // produirait le message anglais par défaut de la bibliothèque.
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

// La suppression exige le mot de passe, et c'est le serveur qui le vérifie. Contrôlée
// côté interface seulement, la confirmation ne protégerait de rien : un jeton dérobé
// suffirait à supprimer le compte sans jamais connaître le mot de passe.
const schemaSuppressionCompte = z
  .object({
    motDePasse: z
      .string('Le mot de passe est obligatoire.')
      .min(1, 'Le mot de passe est obligatoire.'),
  })
  .strict();

module.exports = { schemaChangementMotDePasse, schemaSuppressionCompte };
