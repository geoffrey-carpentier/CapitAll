// Récupération d'un mot de passe oublié (D23).
//
// D23 laisse à l'administrateur un privilège minimal et lui interdit explicitement
// d'accéder aux données d'autrui ; réinitialiser le mot de passe d'un tiers reviendrait
// à lui donner les clés d'un portefeuille. La récupération appartient donc à
// l'utilisateur seul, et elle passe par un jeton qu'il est le seul à recevoir.
//
// LE PROJET N'ENVOIE PAS DE COURRIEL. Aucun service d'envoi n'est au périmètre, et en
// ajouter un supposerait un compte externe, une clé et une adresse d'expédition
// vérifiée. Le jeton est donc affiché à l'écran, sur décision du PO, pour que le
// parcours soit démontrable de bout en bout.
//
// Cette commodité a un coût, et il faut le nommer plutôt que de le laisser passer : un
// jeton rendu dans la réponse n'apparaît que si l'adresse correspond à un compte, ce qui
// révèle l'existence de ce compte. Elle est donc fermée par défaut et ouverte par une
// variable d'environnement. Un déploiement réel la laisse fermée et branche un envoi.

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const modeleUtilisateur = require('../models/utilisateur');
const modeleReinitialisation = require('../models/reinitialisation');
const config = require('../config');
const { COUT_HACHAGE } = require('./authentification');
const { ErreurValidation } = require('../erreurs');

// Trente-deux octets tirés au hasard, rendus en hexadécimal. Le jeton n'est pas
// devinable, ce qui justifie de l'empreindre en SHA-256 plutôt qu'en bcrypt : le coût de
// bcrypt protège les secrets à faible entropie, un mot de passe et non un aléa.
const OCTETS_JETON = 32;

// Une heure. Assez pour aller le chercher, assez court pour qu'un jeton égaré cesse
// vite de valoir quelque chose.
const VALIDITE_MINUTES = 60;

// Réponse unique, que l'adresse corresponde ou non à un compte. Dire « aucun compte à
// cette adresse » transformerait le formulaire en outil d'énumération.
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

    // Adresse inconnue, ou compte désactivé : rien n'est créé, et la réponse est la même
    // que dans le cas nominal. Un compte désactivé ne se réactive pas par ce chemin.
    if (!utilisateur || !utilisateur.actif) {
      return { message: MESSAGE_NEUTRE, jeton: null };
    }

    // Les demandes précédentes tombent : le nombre de clés en circulation pour un même
    // compte reste ainsi d'une au plus.
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
      // Le jeton ne sort que si la commodité de démonstration est ouverte. Fermée, la
      // réponse est strictement la même pour une adresse connue et pour une inconnue.
      jeton: parametres.afficherJetonReinitialisation ? jeton : null,
      expire_le: parametres.afficherJetonReinitialisation ? expireLe.toISOString() : undefined,
    };
  }

  async function reinitialiser({ jeton, nouveauMotDePasse }) {
    const demande = await demandes.trouverParEmpreinte(empreinte(jeton));

    // Un seul message pour les quatre causes de refus — jeton inconnu, déjà servi,
    // expiré, compte désactivé. Les distinguer apprendrait à un tiers qu'un jeton a
    // existé, et lequel des cas s'applique.
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

    // La consommation précède l'écriture du mot de passe, et sa condition est portée par
    // la requête : deux appels simultanés avec le même jeton ne peuvent pas réussir tous
    // les deux, le second ne trouvant plus de ligne à marquer.
    const consommee = await demandes.marquerUtilisee(demande.id);
    if (!consommee) {
      throw new ErreurValidation(MESSAGE_JETON_REFUSE, [
        { champ: 'jeton', message: MESSAGE_JETON_REFUSE },
      ]);
    }

    const hachage = await bcrypt.hash(nouveauMotDePasse, COUT_HACHAGE);
    // La mise à jour pose la borne de révocation : toutes les sessions ouvertes du
    // compte tombent. C'est indispensable ici — on réinitialise précisément quand on ne
    // maîtrise plus l'accès, et laisser vivre les sessions existantes viderait
    // l'opération de son sens.
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
