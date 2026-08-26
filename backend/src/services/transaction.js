// Orchestration de l'enregistrement d'une transaction : lecture de l'historique,
// application de la règle de vente, puis écriture. Les règles de calcul elles-mêmes
// vivent dans portefeuille.js et calculPortefeuille.js, qui restent sans dépendance à
// la base et donc testables seuls.
//
// Les modèles sont injectables, comme pour le service de portefeuille et celui
// d'authentification : le service s'exécute alors sans base dans les tests, avec le
// même code qu'en production.

const modeleActif = require('../models/actif');
const modeleTransaction = require('../models/transaction');
const { verifierVenteAutorisee } = require('./portefeuille');
const { derouler } = require('./calculPortefeuille');
const { ECHELLE_PRU, versUnites, versChaine } = require('../utils/decimal');
const { ErreurIntrouvable } = require('../erreurs');

// Identifiant prêté au mouvement hypothétique d'une simulation. Il n'est jamais
// écrit : il sert uniquement à retrouver ce mouvement parmi les autres après le
// déroulé, qui les réordonne. Le plus grand entier sûr place aussi le mouvement en
// dernier lorsqu'il partage sa date avec un mouvement déjà enregistré, ce qui est
// l'ordre dans lequel il serait effectivement inséré.
const ID_SIMULATION = Number.MAX_SAFE_INTEGER;

function creerServiceTransaction({
  actifs = modeleActif,
  transactions = modeleTransaction,
} = {}) {
  // Contrôle d'existence et de propriété en une seule requête filtrée. Un actif
  // appartenant à un autre compte est indiscernable d'un actif inexistant (D52).
  async function exigerActif(actifId, utilisateurId) {
    const actif = await actifs.trouverParIdEtUtilisateur(actifId, utilisateurId);
    if (!actif) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }
    return actif;
  }

  async function enregistrer({ actifId, utilisateurId, donnees }) {
    await exigerActif(actifId, utilisateurId);

    // L'historique n'est chargé que pour une vente : un achat n'a rien à contrôler.
    if (donnees.sens === 'vente') {
      const historique = await transactions.listerParActifEtUtilisateur(actifId, utilisateurId);
      verifierVenteAutorisee(historique, donnees.quantite);
    }

    return transactions.creer({
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

  // Effet d'un mouvement qui n'est pas encore enregistré : ce que la position vaut
  // avant, ce qu'elle vaudra après, et ce que l'opération déplace.
  //
  // C'est le récapitulatif que l'écran de saisie présente avant validation. Il est
  // calculé ici et non côté interface (D69) : le prix de revient est une moyenne
  // pondérée sur toute l'histoire de la position, et une seconde implémentation de
  // cette règle finirait par diverger de celle du moteur. La simulation rejoue donc
  // exactement le même déroulé que l'enregistrement, à l'écriture près.
  //
  // La règle de vente est appliquée avant tout calcul : une vente impossible se
  // signale au moment de la saisie, avec le message qu'aurait rendu la validation.
  async function simuler({ actifId, utilisateurId, donnees }) {
    await exigerActif(actifId, utilisateurId);

    const historique = await transactions.listerParActifEtUtilisateur(actifId, utilisateurId);
    if (donnees.sens === 'vente') {
      verifierVenteAutorisee(historique, donnees.quantite);
    }

    const hypothetique = {
      id: ID_SIMULATION,
      sens: donnees.sens,
      quantite: donnees.quantite,
      prix_unitaire: donnees.prix_unitaire,
      frais: donnees.frais,
      date_transaction: donnees.date_transaction,
    };

    const avant = derouler(historique).position;
    const { mouvements, position: apres } = derouler([...historique, hypothetique]);
    const simule = mouvements.find((mouvement) => mouvement.id === ID_SIMULATION);

    return {
      sens: donnees.sens,
      // Montant brut de l'opération, frais exclus : ils sont rendus à part, comme
      // dans la frise des mouvements, où les additionner les compterait deux fois.
      montant: simule.montant,
      frais: donnees.frais,
      quantite_detenue_avant: avant.quantite_detenue,
      quantite_detenue_apres: apres.quantite_detenue,
      pru_avant: avant.pru,
      pru_apres: apres.pru,
      // Déplacement du prix de revient de la position, et non celui que le seul
      // mouvement provoque à sa place dans l'histoire : une saisie rétroactive
      // change l'état final sans être le dernier mouvement du déroulé.
      effet_pru: versChaine(
        versUnites(apres.pru, ECHELLE_PRU) - versUnites(avant.pru, ECHELLE_PRU),
        ECHELLE_PRU
      ),
      // Nulle sur un achat, qui ne dégage aucune plus-value.
      plus_value_realisee: simule.plus_value_realisee,
      cout_total_apres: apres.cout_total,
    };
  }

  async function supprimer({ actifId, idTransaction, utilisateurId }) {
    const supprimee = await transactions.supprimer(idTransaction, actifId, utilisateurId);
    if (!supprimee) {
      throw new ErreurIntrouvable('Transaction introuvable.');
    }
  }

  return { enregistrer, simuler, supprimer };
}

module.exports = { creerServiceTransaction };
