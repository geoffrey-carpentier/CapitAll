// Orchestration de l'enregistrement d'une transaction : lecture de l'historique,
// application de la règle de vente, puis écriture. Les règles de calcul elles-mêmes
// vivent dans portefeuille.js, qui reste sans dépendance à la base et donc testable seul.

const modeleActif = require('../models/actif');
const modeleTransaction = require('../models/transaction');
const { verifierVenteAutorisee } = require('./portefeuille');
const { ErreurIntrouvable } = require('../erreurs');

async function enregistrer({ actifId, utilisateurId, donnees }) {
  // Contrôle d'existence et de propriété en une seule requête filtrée.
  const actif = await modeleActif.trouverParIdEtUtilisateur(actifId, utilisateurId);
  if (!actif) {
    throw new ErreurIntrouvable('Actif introuvable.');
  }

  // L'historique n'est chargé que pour une vente : un achat n'a rien à contrôler.
  if (donnees.sens === 'vente') {
    const historique = await modeleTransaction.listerParActifEtUtilisateur(actifId, utilisateurId);
    verifierVenteAutorisee(historique, donnees.quantite);
  }

  return modeleTransaction.creer({
    actifId,
    utilisateurId,
    sens: donnees.sens,
    quantite: donnees.quantite,
    prixUnitaire: donnees.prix_unitaire,
    frais: donnees.frais,
    dateTransaction: donnees.date_transaction,
    note: donnees.note,
  });
}

async function supprimer({ actifId, idTransaction, utilisateurId }) {
  const supprimee = await modeleTransaction.supprimer(idTransaction, actifId, utilisateurId);
  if (!supprimee) {
    throw new ErreurIntrouvable('Transaction introuvable.');
  }
}

module.exports = { enregistrer, supprimer };
