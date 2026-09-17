// Gestion du compte : changement de mot de passe, suppression et export des mouvements.
// Sans Express ni HTTP, dépendances injectées pour tester sans base.

const bcrypt = require('bcrypt');
const modeleUtilisateur = require('../models/utilisateur');
const modeleTransaction = require('../models/transaction');
const { COUT_HACHAGE, emettreJeton } = require('./authentification');
const { derouler, trierChronologiquement } = require('./calculPortefeuille');
const { construire } = require('../utils/csv');
const { ErreurValidation, ErreurIntrouvable } = require('../erreurs');

// Colonnes de l'export, dans l'ordre du fichier. Les trois colonnes de frais restent
// voisines. La colonne type distingue sortie_non_marchande d'une vente.
const ENTETES = [
  'date',
  'type',
  'actif',
  'classe',
  'quantite',
  'prix_unitaire',
  'frais',
  'frais_montant',
  'frais_unite',
  'montant',
];

const PREFIXE_FICHIER = 'walletwatch-mouvements';

function jourCourant() {
  return new Date().toISOString().slice(0, 10);
}

// pg rend un TIMESTAMPTZ en Date, les jeux d'essai parfois en chaîne : une seule forme
// en sortie.
function enIso(valeur) {
  return new Date(valeur).toISOString();
}

// Les montants viennent de derouler(), le moteur de l'écran de détail : l'export porte
// exactement les chiffres affichés. derouler() travaillant par position, les mouvements
// sont groupés par actif puis remis en ordre chronologique.
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

    // Compte supprimé depuis l'émission du jeton.
    if (!utilisateur) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }

    const ancienValide = await bcrypt.compare(ancienMotDePasse, utilisateur.mot_de_passe_hache);

    // Erreur rattachée au champ à corriger.
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

    // La mise à jour pose une borne de révocation : tous les jetons antérieurs tombent,
    // y compris celui de la session courante. Un jeton neuf est donc émis ici, avec la
    // borne, pour que cette session continue.
    return { token: emettreJeton({ id: utilisateur.id, role: utilisateur.role }) };
  }

  async function supprimer({ utilisateurId, motDePasse }) {
    const utilisateur = await utilisateurs.trouverAvecHachageParId(utilisateurId);

    if (!utilisateur) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }

    // Vérifiée côté serveur : un jeton dérobé ne doit pas suffire à supprimer le compte.
    const valide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hache);

    if (!valide) {
      throw new ErreurValidation('Mot de passe incorrect.', [
        { champ: 'motDePasse', message: 'Mot de passe incorrect.' },
      ]);
    }

    const supprime = await utilisateurs.supprimer(utilisateurId);

    if (!supprime) {
      throw new ErreurIntrouvable('Utilisateur introuvable.');
    }
  }

  async function exporterMouvements({ utilisateurId }) {
    // Cloisonnement porté par la requête SQL (jointure sur le propriétaire de l'actif).
    const mouvements = await transactions.listerParUtilisateur(utilisateurId);

    const lignes = calculerMontants(mouvements).map((mouvement) => [
      enIso(mouvement.date_transaction),
      mouvement.sens,
      mouvement.symbole,
      mouvement.classe,
      // Décimales brutes de la base, avec un point : pas de formatage à la française
      // dans un fichier d'échange.
      mouvement.quantite,
      mouvement.prix_unitaire,
      mouvement.frais,
      mouvement.frais_montant ?? mouvement.frais,
      mouvement.frais_unite ?? 'EUR',
      mouvement.montant,
    ]);

    // Sans mouvement, le fichier contient au moins l'en-tête.
    return {
      nomFichier: `${PREFIXE_FICHIER}-${jourCourant()}.csv`,
      contenu: construire(ENTETES, lignes),
    };
  }

  return { changerMotDePasse, supprimer, exporterMouvements };
}

// Instance par défaut, utilisée par les contrôleurs.
const service = creerServiceCompte();

module.exports = {
  creerServiceCompte,
  ENTETES,
  changerMotDePasse: service.changerMotDePasse,
  supprimer: service.supprimer,
  exporterMouvements: service.exporterMouvements,
};
