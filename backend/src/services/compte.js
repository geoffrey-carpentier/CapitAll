// Logique métier de la gestion du compte : changement de mot de passe, suppression et
// export des mouvements. Comme les autres services, il ne connaît ni Express ni les
// codes HTTP, et reçoit ses dépendances en paramètre pour rester testable sans base.

const bcrypt = require('bcrypt');
const modeleUtilisateur = require('../models/utilisateur');
const modeleTransaction = require('../models/transaction');
const { COUT_HACHAGE } = require('./authentification');
const { derouler, trierChronologiquement } = require('./calculPortefeuille');
const { construire } = require('../utils/csv');
const { ErreurValidation, ErreurIntrouvable } = require('../erreurs');

// Colonnes de l'export, dans l'ordre du fichier (D84).
const ENTETES = ['date', 'type', 'actif', 'classe', 'quantite', 'prix_unitaire', 'frais', 'montant'];

const PREFIXE_FICHIER = 'capitall-mouvements';

function jourCourant() {
  return new Date().toISOString().slice(0, 10);
}

// pg rend un TIMESTAMPTZ sous forme d'objet Date ; les jeux d'essai le donnent parfois
// déjà en chaîne. Les deux passent par Date pour ne produire qu'une seule forme.
function enIso(valeur) {
  return new Date(valeur).toISOString();
}

// Le montant de chaque ligne n'est pas recalculé ici : il est produit par derouler(),
// le moteur qui le calcule déjà pour l'écran de détail d'une position. La formule, ses
// échelles intermédiaires et son arrondi gardent ainsi un propriétaire unique (D69), et
// le fichier exporté porte exactement le chiffre que l'application affiche.
//
// derouler() raisonne par position : les mouvements sont donc groupés par actif, puis
// refondus en une seule liste que l'ordre chronologique du domaine remet en ordre.
function calculerMontants(mouvements) {
  const parActif = new Map();

  for (const mouvement of mouvements) {
    const groupe = parActif.get(mouvement.actif_id);
    if (groupe) {
      groupe.push(mouvement);
    } else {
      parActif.set(mouvement.actif_id, [mouvement]);
    }
  }

  const calcules = [];
  for (const groupe of parActif.values()) {
    calcules.push(...derouler(groupe).mouvements);
  }

  return trierChronologiquement(calcules);
}

function creerServiceCompte({
  utilisateurs = modeleUtilisateur,
  transactions = modeleTransaction,
} = {}) {
  async function changerMotDePasse({ utilisateurId, ancienMotDePasse, nouveauMotDePasse }) {
    const utilisateur = await utilisateurs.trouverAvecHachageParId(utilisateurId);

    // Le porteur d'un jeton valide dont le compte a disparu entre-temps : le cas est
    // improbable mais ne doit pas produire une comparaison bcrypt sur undefined.
    if (!utilisateur) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }

    const ancienValide = await bcrypt.compare(ancienMotDePasse, utilisateur.mot_de_passe_hache);

    // L'erreur est rattachée au champ de l'ancien mot de passe : c'est lui que
    // l'utilisateur doit corriger, et la spécification demande que le message s'y pose
    // plutôt qu'en tête de formulaire. Aucun décompte de tentatives n'est tenu, aucune
    // n'étant prévue par la spécification.
    if (!ancienValide) {
      throw new ErreurValidation('Ancien mot de passe incorrect.', [
        { champ: 'ancienMotDePasse', message: 'Ancien mot de passe incorrect.' },
      ]);
    }

    const hachage = await bcrypt.hash(nouveauMotDePasse, COUT_HACHAGE);
    const misAJour = await utilisateurs.mettreAJourMotDePasse(utilisateurId, hachage);

    if (!misAJour) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }

    // Rien n'est renvoyé, et le jeton en cours reste valable : il est signé sur
    // l'identifiant et le rôle, jamais sur le mot de passe. La session survit donc au
    // changement, comme la spécification l'exige, sans traitement particulier.
  }

  async function supprimer({ utilisateurId }) {
    const supprime = await utilisateurs.supprimer(utilisateurId);

    if (!supprime) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }
  }

  async function exporterMouvements({ utilisateurId }) {
    // Le cloisonnement est porté par la requête elle-même, qui joint actif sur son
    // propriétaire : aucun filtre applicatif ne vient après, et aucun identifiant
    // d'utilisateur ne transite par la requête HTTP.
    const mouvements = await transactions.listerParUtilisateur(utilisateurId);

    const lignes = calculerMontants(mouvements).map((mouvement) => [
      enIso(mouvement.date_transaction),
      mouvement.sens,
      mouvement.symbole,
      mouvement.classe,
      // Les valeurs décimales sortent telles que la base les rend, point décimal
      // compris : un fichier d'échange n'est pas un affichage, le formatage à la
      // française y rendrait les colonnes inexploitables par un tableur.
      mouvement.quantite,
      mouvement.prix_unitaire,
      mouvement.frais,
      mouvement.montant,
    ]);

    // Un compte sans mouvement rend malgré tout un fichier : l'en-tête seul dit que
    // l'export a fonctionné et qu'il n'y avait rien à exporter, là où un fichier vide
    // laisserait croire à un échec.
    return {
      nomFichier: `${PREFIXE_FICHIER}-${jourCourant()}.csv`,
      contenu: construire(ENTETES, lignes),
    };
  }

  return { changerMotDePasse, supprimer, exporterMouvements };
}

// Instance par défaut, utilisée par les contrôleurs, comme pour l'authentification.
const service = creerServiceCompte();

module.exports = {
  creerServiceCompte,
  ENTETES,
  changerMotDePasse: service.changerMotDePasse,
  supprimer: service.supprimer,
  exporterMouvements: service.exporterMouvements,
};
