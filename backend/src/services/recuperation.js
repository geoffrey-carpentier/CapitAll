// Récupération d'un mot de passe oublié, par l'utilisateur lui-même au moyen d'un jeton
// (l'administrateur n'a pas accès aux comptes d'autrui).
//
// Aucun courriel n'est envoyé : pour la démonstration, le jeton peut être rendu dans la
// réponse. Ce mode révèle l'existence d'un compte, il est donc désactivé par défaut et
// activé par une variable d'environnement. En production, il reste fermé et un envoi
// par courriel doit être branché.

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const modeleUtilisateur = require('../models/utilisateur');
const modeleReinitialisation = require('../models/reinitialisation');
const config = require('../config');
const { COUT_HACHAGE } = require('./authentification');
const { ErreurValidation } = require('../erreurs');

// Jeton aléatoire de 32 octets : son entropie justifie une empreinte SHA-256 plutôt que
// bcrypt, dont le coût protège les secrets faibles comme un mot de passe.
const OCTETS_JETON = 32;

const VALIDITE_MINUTES = 60;

// Réponse identique que le compte existe ou non, contre l'énumération des comptes.
const MESSAGE_NEUTRE =
  'Si un compte existe pour cette adresse, une demande de réinitialisation vient d’être créée.';

const MESSAGE_JETON_REFUSE =
  'Cette demande de réinitialisation est inconnue, déjà utilisée ou expirée.';

function empreinte(jeton) {
  return crypto.createHash('sha256').update(jeton).digest('hex');
}

function creerServiceRecuperation({
  utilisateurs = modeleUtilisateur,
  demandes = modeleReinitialisation,
  parametres = config,
} = {}) {
  async function demander({ email }) {
    const utilisateur = await utilisateurs.trouverParEmail(email);

    // Adresse inconnue ou compte désactivé : rien n'est créé, même réponse.
    if (!utilisateur || !utilisateur.actif) {
      return { message: MESSAGE_NEUTRE, jeton: null };
    }

    // Une seule clé valide à la fois par compte.
    await demandes.invaliderPour(utilisateur.id);

    const jeton = crypto.randomBytes(OCTETS_JETON).toString('hex');
    const expireLe = new Date(Date.now() + VALIDITE_MINUTES * 60 * 1000);

    await demandes.creer({
      utilisateurId: utilisateur.id,
      jetonHache: empreinte(jeton),
      expireLe,
    });

    return {
      message: MESSAGE_NEUTRE,
      // Jeton rendu uniquement en mode démonstration.
      jeton: parametres.afficherJetonReinitialisation ? jeton : null,
      expire_le: parametres.afficherJetonReinitialisation ? expireLe.toISOString() : undefined,
    };
  }

  async function reinitialiser({ jeton, nouveauMotDePasse }) {
    const demande = await demandes.trouverParEmpreinte(empreinte(jeton));

    // Un seul message pour les quatre causes de refus, pour ne rien révéler du jeton.
    if (
      !demande ||
      demande.utilise_le !== null ||
      !demande.actif ||
      new Date(demande.expire_le).getTime() <= Date.now()
    ) {
      throw new ErreurValidation(MESSAGE_JETON_REFUSE, [
        { champ: 'jeton', message: MESSAGE_JETON_REFUSE },
      ]);
    }

    // Consommation conditionnelle dans la requête : deux appels simultanés avec le même
    // jeton ne peuvent pas réussir tous les deux.
    const consommee = await demandes.marquerUtilisee(demande.id);
    if (!consommee) {
      throw new ErreurValidation(MESSAGE_JETON_REFUSE, [
        { champ: 'jeton', message: MESSAGE_JETON_REFUSE },
      ]);
    }

    const hachage = await bcrypt.hash(nouveauMotDePasse, COUT_HACHAGE);
    // La mise à jour pose la borne de révocation : toutes les sessions du compte tombent.
    await utilisateurs.mettreAJourMotDePasse(demande.utilisateur_id, hachage);
  }

  return { demander, reinitialiser };
}

const service = creerServiceRecuperation();

module.exports = {
  creerServiceRecuperation,
  MESSAGE_NEUTRE,
  MESSAGE_JETON_REFUSE,
  VALIDITE_MINUTES,
  demander: service.demander,
  reinitialiser: service.reinitialiser,
};
