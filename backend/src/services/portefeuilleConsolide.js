// Orchestration du portefeuille consolidé : charge les données de l'utilisateur,
// demande les cours, applique le moteur de calcul, consolide, puis historise.
//
// Le moteur (calculPortefeuille.js) reste pur : c'est ici, et seulement ici, que la
// base et le service de cours sont sollicités.

const modeleActif = require('../models/actif');
const modeleTransaction = require('../models/transaction');
const modeleSnapshot = require('../models/snapshot');
const { creerServiceCours } = require('./cours');
const { calculerPosition, valoriser, consolider } = require('./calculPortefeuille');
const { ECHELLE_PRU, versUnites, versChaine, diviser } = require('../utils/decimal');
const { ErreurIntrouvable } = require('../erreurs');

// Les modèles et le service de cours sont injectables : le service s'exécute alors
// sans base ni réseau dans les tests, avec le même code qu'en production.
function creerServicePortefeuille({
  serviceCours = creerServiceCours(),
  snapshots = modeleSnapshot,
  actifs: depotActifs = modeleActif,
  transactions: depotTransactions = modeleTransaction,
} = {}) {
  // Charge les positions d'un utilisateur, valorisées au cours courant.
  async function construirePositions(utilisateurId) {
    const actifs = await depotActifs.listerParUtilisateur(utilisateurId);

    if (actifs.length === 0) {
      return { positions: [], coursIndisponibles: [] };
    }

    // Un seul aller-retour pour tous les cours : getCoursMultiples déduplique les
    // symboles, deux actifs pouvant partager une même devise de conversion.
    const cours = await serviceCours.getCoursMultiples(
      actifs.map((actif) => ({ symbole: actif.symbole, type: actif.type }))
    );
    const coursParSymbole = new Map(cours.map((c) => [c.symbole, c]));

    const coursIndisponibles = [];

    const positions = await Promise.all(
      actifs.map(async (actif) => {
        const transactions = await depotTransactions.listerParActifEtUtilisateur(
          actif.id,
          utilisateurId
        );

        const position = calculerPosition(transactions);
        const coursActif = coursParSymbole.get(actif.symbole);

        // Un cours manquant n'invalide pas la réponse : l'actif est renvoyé sans
        // valorisation et son symbole est signalé au front.
        if (!coursActif || coursActif.erreur) {
          coursIndisponibles.push(actif.symbole);
        }

        const valorisee = valoriser(position, coursActif?.erreur ? null : coursActif?.cours_eur);

        return {
          id: actif.id,
          type: actif.type,
          symbole: actif.symbole,
          nom: actif.nom,
          cours_eur: coursActif?.erreur ? null : (coursActif?.cours_eur ?? null),
          source_cours: coursActif?.erreur ? null : (coursActif?.source ?? null),
          horodatage_cours: coursActif?.erreur ? null : (coursActif?.horodatage ?? null),
          ...valorisee,
        };
      })
    );

    return { positions, coursIndisponibles };
  }

  // Taux de change exposé pour la bascule d'affichage euro/dollar (D43).
  //
  // Borne de D43 : aucune conversion n'est faite côté serveur. Tous les montants
  // renvoyés restent en euros, devise de référence des calculs et du stockage (D11).
  // Le front applique ce taux à l'affichage seulement, sans que rien ne soit recalculé
  // ni stocké dans une seconde devise.
  async function obtenirTauxAffichage() {
    try {
      const cours = await serviceCours.getCours('USD', 'devise');

      // getCours rend la valeur d'un dollar en euros ; le front convertit des euros
      // vers des dollars, il a donc besoin de l'inverse. Les deux sens sont exposés
      // pour lever toute ambiguïté sur celui à appliquer.
      const usdVersEur = versUnites(cours.cours_eur, ECHELLE_PRU);
      const eurVersUsd =
        usdVersEur === 0n
          ? null
          : versChaine(diviser(versUnites('1', ECHELLE_PRU), usdVersEur, ECHELLE_PRU), ECHELLE_PRU);

      return {
        eur_vers_usd: eurVersUsd,
        usd_vers_eur: cours.cours_eur,
        horodatage: cours.horodatage,
      };
    } catch (erreur) {
      console.error('Taux de change indisponible pour la bascule d\'affichage :', erreur.message);
      return null;
    }
  }

  async function obtenirPortefeuille(utilisateurId) {
    const { positions, coursIndisponibles } = await construirePositions(utilisateurId);
    const totaux = consolider(positions);
    const tauxAffichage = await obtenirTauxAffichage();

    await historiser(utilisateurId, totaux.valeur_totale, positions, coursIndisponibles);

    return {
      ...totaux,
      actifs: positions,
      cours_indisponibles: coursIndisponibles,
      taux_affichage: tauxAffichage,
    };
  }

  // Écriture paresseuse du snapshot du jour (D49) : déclenchée par la consultation,
  // sans tâche planifiée à maintenir.
  async function historiser(utilisateurId, valeurTotale, positions, coursIndisponibles) {
    // Un portefeuille dont aucun cours n'a pu être obtenu vaudrait zéro dans
    // l'historique. Un trou dans la courbe est préférable à un point faux.
    if (positions.length > 0 && coursIndisponibles.length === positions.length) {
      console.error(
        "Snapshot non enregistré : aucun cours disponible, la valeur du jour serait fausse."
      );
      return;
    }

    try {
      await snapshots.enregistrerSiAbsent(utilisateurId, valeurTotale);
    } catch (erreur) {
      // L'historisation est un effet de bord : son échec ne doit jamais priver
      // l'utilisateur de son portefeuille.
      console.error("Enregistrement du snapshot impossible :", erreur.message);
    }
  }

  // Détail d'un actif : position, valorisation et historique de ses transactions.
  async function obtenirDetailActif(actifId, utilisateurId) {
    const actif = await depotActifs.trouverParIdEtUtilisateur(actifId, utilisateurId);
    if (!actif) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }

    const transactions = await depotTransactions.listerParActifEtUtilisateur(actifId, utilisateurId);
    const position = calculerPosition(transactions);

    let coursActif = null;
    try {
      coursActif = await serviceCours.getCours(actif.symbole, actif.type);
    } catch (erreur) {
      console.error(`Cours indisponible pour ${actif.symbole} :`, erreur.message);
    }

    return {
      ...actif,
      cours_eur: coursActif?.cours_eur ?? null,
      source_cours: coursActif?.source ?? null,
      horodatage_cours: coursActif?.horodatage ?? null,
      ...valoriser(position, coursActif?.cours_eur ?? null),
      transactions,
    };
  }

  async function obtenirHistorique(utilisateurId, nombreDeJours) {
    return snapshots.listerParUtilisateur(utilisateurId, nombreDeJours);
  }

  return { obtenirPortefeuille, obtenirDetailActif, obtenirHistorique };
}

module.exports = { creerServicePortefeuille };
