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
const { executerDansTransaction } = require('../db');
const { verifierHistoriqueSortiesAutorisees } = require('./portefeuille');
const { derouler } = require('./calculPortefeuille');
const {
  ECHELLE_PRU,
  ECHELLE_PRIX,
  ECHELLE_QUANTITE,
  ECHELLE_MONTANT,
  versUnites,
  versChaine,
  formater,
  multiplier,
} = require('../utils/decimal');
const { UNITE_EURO } = require('../validation/transaction');
const { ErreurIntrouvable, ErreurValidation } = require('../erreurs');

// Identifiant prêté au mouvement hypothétique d'une simulation. Il n'est jamais
// écrit : il sert uniquement à retrouver ce mouvement parmi les autres après le
// déroulé, qui les réordonne. Le plus grand entier sûr place aussi le mouvement en
// dernier lorsqu'il partage sa date avec un mouvement déjà enregistré, ce qui est
// l'ordre dans lequel il serait effectivement inséré.
const ID_SIMULATION = Number.MAX_SAFE_INTEGER;

// Motif de refus propre au retrait d'un mouvement. Retirer un achat peut priver de sa
// contrepartie une vente ou une sortie enregistrée plus tard : c'est ce mouvement-là qui
// deviendrait impossible, et non celui que l'utilisateur serait en train de saisir.
const MESSAGE_RETRAIT_IMPOSSIBLE =
  'Ce mouvement ne peut pas être retiré : un mouvement postérieur deviendrait impossible.';

// Même distinction pour la correction d'un mouvement. Réduire la quantité d'un achat
// peut priver de sa contrepartie une vente enregistrée plus tard : le refus porte alors
// sur cette vente-là, et le message de la règle, écrit pour la saisie, tromperait.
const MESSAGE_MODIFICATION_IMPOSSIBLE =
  'Cette correction ne peut pas être enregistrée : un mouvement postérieur deviendrait impossible.';

// Un achat fait entrer de la quantité, les deux autres sens en font sortir : ce sont eux
// qui doivent être confrontés à ce que la position détient réellement (D89).
function faitSortirDeLaQuantite(sens) {
  return sens === 'vente' || sens === 'sortie_non_marchande';
}

// Contre-valeur en euros des frais, quelle que soit l'unité réellement prélevée (D89).
//
// C'est le seul endroit du projet où le taux de conversion des frais est choisi, et il
// n'est jamais deviné. Trois cas, trois provenances explicites :
//
//   en euros            le montant est déjà sa propre contre-valeur ;
//   dans l'actif échangé le prix de l'opération fait le taux, puisque c'est celui
//                       auquel la plateforme a retenu sa part ;
//   dans un tiers actif  aucun taux ne se lit dans le mouvement, l'utilisateur donne
//                       la contre-valeur.
//
// La conversion se fait en arithmétique entière et l'arrondi ne porte que sur la mise en
// euros, au centime, qui est la résolution de la monnaie. Le montant réellement prélevé,
// lui, est conservé tel quel dans son unité : rien n'est perdu.
function convertirLesFrais(donnees, actif) {
  if (donnees.frais_montant === undefined) {
    const montant = donnees.frais ?? '0';
    return { montant, unite: UNITE_EURO, eur: montant };
  }

  const montant = donnees.frais_montant;
  const unite = donnees.frais_unite ?? UNITE_EURO;

  if (unite === UNITE_EURO) {
    return { montant, unite, eur: montant };
  }

  if (unite === actif.symbole) {
    // Des frais prélevés dans l'actif que l'on retire n'en sont pas distincts : ils font
    // partie de la quantité qui sort. Les compter en plus les compterait deux fois.
    if (donnees.sens === 'sortie_non_marchande') {
      throw new ErreurValidation(
        'Des frais prélevés dans cet actif font partie de la quantité qui sort : indiquez-les dans la quantité.',
        [
          {
            champ: 'frais_unite',
            message:
              'Des frais prélevés dans cet actif font partie de la quantité qui sort : indiquez-les dans la quantité.',
          },
        ]
      );
    }

    return {
      montant,
      unite,
      eur: formater(
        multiplier(
          versUnites(montant, ECHELLE_QUANTITE),
          ECHELLE_QUANTITE,
          versUnites(donnees.prix_unitaire, ECHELLE_PRIX),
          ECHELLE_PRIX,
          ECHELLE_PRU
        ),
        ECHELLE_PRU,
        ECHELLE_MONTANT
      ),
    };
  }

  if (donnees.frais_contre_valeur_eur === undefined) {
    const message = `Les frais sont prélevés en ${unite} : indiquez leur contre-valeur en euros au moment de l'opération.`;
    throw new ErreurValidation(message, [
      { champ: 'frais_contre_valeur_eur', message },
    ]);
  }

  return { montant, unite, eur: donnees.frais_contre_valeur_eur };
}

function creerServiceTransaction({
  actifs = modeleActif,
  transactions = modeleTransaction,
  dansTransaction = executerDansTransaction,
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
    return dansTransaction(async (executer) => {
      // Tous les mouvements, achats compris, prennent le même verrou. Une vente qui
      // attend un achat concurrent relira donc cet achat après son commit ; l'ordre
      // inverse valide la vente avant que l'achat ne soit visible, ce qui est le seul
      // comportement sérialisable cohérent.
      const actif = await actifs.verrouillerParIdEtUtilisateur(
        actifId,
        utilisateurId,
        executer
      );
      if (!actif) {
        throw new ErreurIntrouvable('Actif introuvable.');
      }

      const frais = convertirLesFrais(donnees, actif);

      if (faitSortirDeLaQuantite(donnees.sens)) {
        const historique = await transactions.listerParActifEtUtilisateur(
          actifId,
          utilisateurId,
          executer
        );
        verifierHistoriqueSortiesAutorisees([
          ...historique,
          mouvementHypothetique(donnees, frais),
        ]);
      }

      return transactions.creer({
        actifId,
        utilisateurId,
        sens: donnees.sens,
        quantite: donnees.quantite,
        prixUnitaire: prixEnregistre(donnees),
        frais: frais.eur,
        fraisMontant: frais.montant,
        fraisUnite: frais.unite,
        dateTransaction: donnees.date_transaction,
        note: donnees.note,
      }, executer);
    });
  }

  // Une sortie non marchande n'a pas de prix, et la contrainte de schéma exige zéro.
  // Le champ est facultatif à la saisie pour ce sens : la valeur écrite est posée ici
  // plutôt que laissée à l'appelant, qui pourrait l'omettre ou en inventer une.
  function prixEnregistre(donnees) {
    return donnees.sens === 'sortie_non_marchande' ? '0' : donnees.prix_unitaire;
  }

  // Un mouvement d'un autre compte est indiscernable d'un mouvement inexistant (D52) :
  // l'historique consulté est déjà filtré sur le propriétaire, il suffit d'y chercher.
  function exigerMouvement(historique, idTransaction) {
    const existe = historique.some(
      (transaction) => String(transaction.id) === String(idTransaction)
    );
    if (!existe) {
      throw new ErreurIntrouvable('Transaction introuvable.');
    }
  }

  // Histoire de la position telle qu'elle serait si l'opération était acceptée : le
  // mouvement s'ajoute à la fin sur une création, il en remplace un sur une correction.
  function projeter(historique, hypothetique, idRemplace) {
    if (idRemplace === null) {
      return [...historique, hypothetique];
    }

    return historique.map((transaction) =>
      String(transaction.id) === String(idRemplace) ? hypothetique : transaction
    );
  }

  // Invariant unique — aucun préfixe chronologique ne passe sous zéro — appliqué à la
  // projection, et refus requalifié lorsque le mouvement en défaut n'est pas celui que
  // l'utilisateur vient de saisir.
  function verifierProjection(projete, idSaisi, messageDeRepli) {
    try {
      verifierHistoriqueSortiesAutorisees(projete);
    } catch (erreur) {
      const enDefautAilleurs =
        idSaisi !== null && String(erreur.mouvement?.id) !== String(idSaisi);

      if (erreur instanceof ErreurValidation && enDefautAilleurs) {
        throw new ErreurValidation(messageDeRepli);
      }
      throw erreur;
    }
  }

  function mouvementHypothetique(donnees, frais, id = ID_SIMULATION) {
    return {
      id,
      sens: donnees.sens,
      quantite: donnees.quantite,
      prix_unitaire: prixEnregistre(donnees),
      // Le moteur ne consomme que la contre-valeur en euros : c'est elle qui entre dans
      // le prix de revient, jamais le montant prélevé dans son unité d'origine.
      frais: frais.eur,
      date_transaction: donnees.date_transaction,
    };
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
  //
  // `idTransaction` fait basculer la simulation en mode édition (D51 révisée) : le
  // mouvement n'est plus ajouté à la fin de l'histoire, il en remplace un. La position
  // « avant » reste celle d'aujourd'hui, celle que l'utilisateur a sous les yeux ; c'est
  // donc l'écart entre les deux qui répond à sa question, « qu'est-ce que ma correction
  // change ». Un mouvement modifié conserve son identifiant et donc sa place dans
  // l'ordre chronologique, à la différence d'une création qui se pose en dernier.
  async function simuler({ actifId, idTransaction = null, utilisateurId, donnees }) {
    const actif = await exigerActif(actifId, utilisateurId);
    const frais = convertirLesFrais(donnees, actif);

    const historique = await transactions.listerParActifEtUtilisateur(actifId, utilisateurId);
    const edition = idTransaction !== null && idTransaction !== undefined;

    if (edition) {
      exigerMouvement(historique, idTransaction);
    }

    const hypothetique = mouvementHypothetique(
      donnees,
      frais,
      edition ? idTransaction : ID_SIMULATION
    );
    const projete = projeter(historique, hypothetique, edition ? idTransaction : null);

    if (faitSortirDeLaQuantite(donnees.sens) || edition) {
      verifierProjection(projete, edition ? idTransaction : null, MESSAGE_MODIFICATION_IMPOSSIBLE);
    }

    const avant = derouler(historique).position;
    const { mouvements, position: apres } = derouler(projete);
    const simule = mouvements.find(
      (mouvement) => String(mouvement.id) === String(hypothetique.id)
    );

    return {
      sens: donnees.sens,
      // Montant brut de l'opération, frais exclus : ils sont rendus à part, comme
      // dans la frise des mouvements, où les additionner les compterait deux fois.
      montant: simule.montant,
      // Contre-valeur en euros, celle qui entre dans le calcul, accompagnée de ce qui a
      // réellement été prélevé : l'écran de saisie doit pouvoir dire « 0,002 ETH, soit
      // 5,00 € » et non l'un des deux seulement.
      frais: frais.eur,
      frais_montant: frais.montant,
      frais_unite: frais.unite,
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
      // Nulle sur un achat, qui ne dégage aucune plus-value, et sur une sortie non
      // marchande, qui n'est pas une vente.
      plus_value_realisee: simule.plus_value_realisee,
      // Valeur qui quitte le portefeuille au prix de revient, sur une sortie non
      // marchande seulement. C'est ce chiffre, et non une plus-value, que l'écran de
      // saisie annonce pour un retrait ou un transfert.
      cout_sortie: simule.cout_sortie,
      cout_total_apres: apres.cout_total,
    };
  }

  // Correction d'un mouvement déjà enregistré (D51, révisée par D89).
  //
  // Le chemin est celui de la suppression, au remplacement près : même verrou sur
  // l'actif, même relecture de l'historique dans la transaction qui écrira, même
  // invariant appliqué à ce que l'historique deviendrait. C'était l'argument décisif
  // pour rouvrir D51 — l'édition ne demandait pas un mécanisme de plus, mais un `map`
  // là où la suppression pose un `filter`.
  //
  // La relecture a lieu **après** la prise du verrou, jamais avant : deux corrections
  // concurrentes sur la même position se sérialisent, et la seconde travaille sur
  // l'historique que la première a laissé. Vérifier hors du verrou reviendrait à valider
  // une correction contre un état déjà périmé.
  async function modifier({ actifId, idTransaction, utilisateurId, donnees }) {
    return dansTransaction(async (executer) => {
      const actif = await actifs.verrouillerParIdEtUtilisateur(actifId, utilisateurId, executer);
      if (!actif) {
        throw new ErreurIntrouvable('Transaction introuvable.');
      }

      const historique = await transactions.listerParActifEtUtilisateur(
        actifId,
        utilisateurId,
        executer
      );
      exigerMouvement(historique, idTransaction);

      const frais = convertirLesFrais(donnees, actif);
      const remplacant = mouvementHypothetique(donnees, frais, idTransaction);

      // L'invariant est vérifié avant toute écriture, et à l'intérieur de la
      // transaction : un refus ne laisse donc rien derrière lui, ni ligne modifiée ni
      // ligne à moitié réécrite.
      verifierProjection(
        projeter(historique, remplacant, idTransaction),
        idTransaction,
        MESSAGE_MODIFICATION_IMPOSSIBLE
      );

      const modifiee = await transactions.mettreAJour(
        {
          id: idTransaction,
          actifId,
          utilisateurId,
          sens: donnees.sens,
          quantite: donnees.quantite,
          prixUnitaire: prixEnregistre(donnees),
          frais: frais.eur,
          fraisMontant: frais.montant,
          fraisUnite: frais.unite,
          dateTransaction: donnees.date_transaction,
          note: donnees.note,
        },
        executer
      );

      if (!modifiee) {
        throw new ErreurIntrouvable('Transaction introuvable.');
      }

      return modifiee;
    });
  }

  async function supprimer({ actifId, idTransaction, utilisateurId }) {
    return dansTransaction(async (executer) => {
      const actif = await actifs.verrouillerParIdEtUtilisateur(
        actifId,
        utilisateurId,
        executer
      );
      if (!actif) {
        throw new ErreurIntrouvable('Transaction introuvable.');
      }

      const historique = await transactions.listerParActifEtUtilisateur(
        actifId,
        utilisateurId,
        executer
      );
      const existe = historique.some((transaction) => String(transaction.id) === String(idTransaction));
      if (!existe) {
        throw new ErreurIntrouvable('Transaction introuvable.');
      }

      const historiqueApresSuppression = historique.filter(
        (transaction) => String(transaction.id) !== String(idTransaction)
      );

      // L'invariant reste exactement celui de la création : aucun préfixe chronologique
      // ne peut passer sous zéro. Seul le message change. Celui de la règle est rédigé
      // pour la saisie d'une vente et n'a aucun sens en réponse au retrait d'un achat.
      try {
        verifierHistoriqueSortiesAutorisees(historiqueApresSuppression);
      } catch (erreur) {
        if (erreur instanceof ErreurValidation) {
          throw new ErreurValidation(MESSAGE_RETRAIT_IMPOSSIBLE);
        }
        throw erreur;
      }

      const supprimee = await transactions.supprimer(
        idTransaction,
        actifId,
        utilisateurId,
        executer
      );
      if (!supprimee) {
        throw new ErreurIntrouvable('Transaction introuvable.');
      }
    });
  }

  return { enregistrer, simuler, modifier, supprimer };
}

module.exports = { creerServiceTransaction };
