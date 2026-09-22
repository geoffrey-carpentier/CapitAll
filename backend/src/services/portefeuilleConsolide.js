// Orchestration du portefeuille consolidé : charge les données de l'utilisateur,
// demande les cours, applique le moteur de calcul et consolide.
//
// Deux entrées pour un même calcul : `obtenirPortefeuille` ne fait que lire, et
// `actualiserPortefeuille` ajoute l'écriture du point du jour et l'évaluation des seuils.
// Une lecture peut être rejouée par n'importe quoi : elle ne doit rien changer.
//
// Le moteur (calculPortefeuille.js) reste pur : c'est ici, et seulement ici, que la
// base et le service de cours sont sollicités.

const modeleActif = require('../models/actif');
const modeleTransaction = require('../models/transaction');
const modeleSnapshot = require('../models/snapshot');
const modeleSnapshotCours = require('../models/snapshotCours');
const modeleAlerte = require('../models/alerte');
const { evaluerAlertes } = require('./evaluationAlertes');
const { creerServiceCours } = require('./cours');
const {
  derouler,
  calculerPosition,
  valoriser,
  consolider,
  calculerPerformances,
  performanceSurPeriode,
} = require('./calculPortefeuille');
const {
  ECHELLE_TAUX,
  ECHELLE_QUANTITE,
  versUnites,
  versChaine,
  diviser,
} = require('../utils/decimal');
const { ErreurIntrouvable } = require('../erreurs');

// Fenêtre de la tendance affichée en regard de chaque position dans le tableau des
// positions. Trente jours : c'est la plage que porte la maquette desktop, et celle qui
// correspond au rythme réel de consultation d'un patrimoine.
const JOURS_DE_TENDANCE = 30;

// Les modèles et le service de cours sont injectables : le service s'exécute alors
// sans base ni réseau dans les tests, avec le même code qu'en production.
function creerServicePortefeuille({
  serviceCours = creerServiceCours(),
  snapshots = modeleSnapshot,
  snapshotsCours = modeleSnapshotCours,
  actifs: depotActifs = modeleActif,
  transactions: depotTransactions = modeleTransaction,
  alertes: depotAlertes = modeleAlerte,
} = {}) {
  async function construirePositions(utilisateurId) {
    const actifs = await depotActifs.listerParUtilisateur(utilisateurId);

    if (actifs.length === 0) {
      return { positions: [], coursIndisponibles: [], capitalComplet: true };
    }

    // Un seul aller-retour pour tous les cours : getCoursMultiples déduplique les
    // symboles, deux actifs pouvant partager une même devise de conversion.
    const cours = await serviceCours.getCoursMultiples(
      actifs.map((actif) => ({ symbole: actif.symbole, type: actif.type }))
    );
    const coursParSymbole = new Map(cours.map((c) => [c.symbole, c]));

    // Une seule requête pour tous les mouvements du compte, regroupés ensuite en
    // mémoire, plutôt qu'une par position. Le moteur retrie chaque série.
    const mouvements = await depotTransactions.listerParUtilisateur(utilisateurId);
    const mouvementsParActif = new Map();
    for (const mouvement of mouvements) {
      const serie = mouvementsParActif.get(mouvement.actif_id) ?? [];
      serie.push(mouvement);
      mouvementsParActif.set(mouvement.actif_id, serie);
    }

    const coursIndisponibles = [];

    const positions = actifs.map((actif) => {
      const position = calculerPosition(mouvementsParActif.get(actif.id) ?? []);
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
    });

    return { positions, coursIndisponibles, capitalComplet: capitalEstComplet(positions) };
  }

  // Le total consolidé est-il le capital, ou seulement une part de celui-ci ?
  //
  // La question n'est pas « manque-t-il un cours ? » mais « manque-t-il un cours qui
  // compte ? ». Une position soldée ne pèse rien quel que soit son cours : la déclarer
  // lacunaire priverait l'utilisateur de son capital pour une ligne qui vaut zéro. Seule
  // une position réellement détenue et non valorisée rend le total incomplet.
  function capitalEstComplet(positions) {
    return positions.every(
      (position) =>
        position.cours_eur !== null ||
        versUnites(position.quantite_detenue ?? '0', ECHELLE_QUANTITE) === 0n
    );
  }

  // Taux de change exposé pour la bascule d'affichage euro/dollar. Les montants restent
  // en euros ; le front n'applique ce taux qu'à l'affichage.
  async function obtenirTauxAffichage() {
    try {
      const cours = await serviceCours.getCours('USD', 'devise');

      // getCours rend la valeur d'un dollar en euros ; le front convertit des euros
      // vers des dollars, il a donc besoin de l'inverse. Les deux sens sont exposés
      // pour lever toute ambiguïté sur celui à appliquer.
      const usdVersEur = versUnites(cours.cours_eur, ECHELLE_TAUX);
      const eurVersUsd =
        usdVersEur === 0n
          ? null
          : versChaine(
              diviser(
                versUnites('1', ECHELLE_TAUX),
                ECHELLE_TAUX,
                usdVersEur,
                ECHELLE_TAUX,
                ECHELLE_TAUX
              ),
              ECHELLE_TAUX
            );

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

  // Lecture du portefeuille, sans aucune écriture.
  async function obtenirPortefeuille(utilisateurId) {
    return composerPortefeuille(utilisateurId, { avecEffets: false });
  }

  // Actualisation : la même lecture, plus l'écriture paresseuse du point du jour et
  // l'évaluation des seuils. Aucune tâche planifiée : c'est une commande explicite du
  // tableau de bord qui déclenche.
  async function actualiserPortefeuille(utilisateurId) {
    return composerPortefeuille(utilisateurId, { avecEffets: true });
  }

  async function composerPortefeuille(utilisateurId, { avecEffets }) {
    const { positions, coursIndisponibles, capitalComplet } =
      await construirePositions(utilisateurId);
    const totaux = consolider(positions);
    const tauxAffichage = await obtenirTauxAffichage();

    // Sur une lecture, la liste part vide : aucune alerte n'a été évaluée, et annoncer
    // un franchissement qu'on n'a pas cherché serait faux. Le tableau de bord, qui seul
    // affiche ces franchissements, passe par l'actualisation.
    let alertesDeclenchees = [];

    if (avecEffets) {
      await historiser(utilisateurId, totaux.valeur_totale, positions, capitalComplet);
      alertesDeclenchees = await traiterAlertes(
        utilisateurId,
        capitalComplet ? totaux.valeur_totale : null,
        positions
      );
    }

    // L'historisation précède la lecture des tendances : le point du jour vient d'être
    // écrit et doit compter dans la fenêtre, sans quoi la tendance affichée s'arrêterait
    // systématiquement la veille.
    const tendances = await obtenirTendances(utilisateurId);

    return {
      ...totaux,
      actifs: positions.map((position) => ({
        ...position,
        tendance_30j: tendances.get(position.id) ?? null,
      })),
      cours_indisponibles: coursIndisponibles,
      // Le front en a besoin pour qualifier le montant dominant : un sous-total reste
      // utile à voir, à condition d'être annoncé comme tel plutôt que présenté comme le
      // patrimoine.
      capital_complet: capitalComplet,
      taux_affichage: tauxAffichage,
      alertes_declenchees: alertesDeclenchees,
    };
  }

  // Évaluation des alertes à l'actualisation. C'est un effet de bord : un échec est
  // journalisé et la réponse part quand même.
  //
  // capitalTotal vaut null si la couverture est incomplète : une alerte sur le capital
  // n'est alors pas évaluée, plutôt que de se déclencher sur un sous-total. Les alertes
  // sur un actif se comparent à son cours et restent évaluées.
  async function traiterAlertes(utilisateurId, capitalTotal, positions) {
    try {
      const actives = await depotAlertes.listerActivesParUtilisateur(utilisateurId);
      if (actives.length === 0) {
        return [];
      }

      // Les alertes sur actif se comparent au cours, pas à la valeur de la position.
      const coursParActif = Object.fromEntries(
        positions.filter((p) => p.cours_eur !== null).map((p) => [p.id, p.cours_eur])
      );

      const franchies = evaluerAlertes(actives, { capitalTotal, coursParActif });

      if (franchies.length > 0) {
        await depotAlertes.marquerDeclenchees(
          utilisateurId,
          franchies.map((alerte) => alerte.id)
        );
      }

      return franchies;
    } catch (erreur) {
      console.error("Évaluation des alertes impossible :", erreur.message);
      return [];
    }
  }

  // Écriture paresseuse du snapshot du jour, déclenchée par l'actualisation, sans tâche
  // planifiée. Le point porte son heure de relevé, que l'interface annonce.
  async function historiser(utilisateurId, valeurTotale, positions, capitalComplet) {
    // Le total du jour n'est enregistré que s'il est le capital complet : un sous-total
    // se lirait comme une baisse, et l'unicité par date le figerait pour la journée. Un
    // trou dans la courbe reste préférable à un point faux.
    if (capitalComplet) {
      try {
        await snapshots.enregistrerSiAbsent(utilisateurId, valeurTotale);
      } catch (erreur) {
        // L'historisation est un effet de bord : son échec ne doit jamais priver
        // l'utilisateur de son portefeuille.
        console.error("Enregistrement du snapshot impossible :", erreur.message);
      }
    } else {
      console.error(
        'Snapshot de valorisation non enregistré : au moins une position détenue est sans ' +
          'cours, la valeur du jour serait inférieure au patrimoine réel.'
      );
    }

    // Historique par position, au même endroit. Les positions sans cours sont écartées
    // plutôt qu'enregistrées à zéro. Cette écriture ne dépend pas de la complétude du
    // total : chaque série est indépendante, et un cours du jour ne se retrouve pas demain.
    try {
      await snapshotsCours.enregistrerSiAbsent(utilisateurId, positions);
    } catch (erreur) {
      console.error("Enregistrement de l'historique des cours impossible :", erreur.message);
    }
  }

  // Tendance récente de chaque position, indexée par identifiant d'actif.
  //
  // La variation est calculée ici, comme toute valeur dérivée de cours ; les points ne
  // servent qu'au tracé de la courbe miniature.
  async function obtenirTendances(utilisateurId) {
    try {
      const releves = await snapshotsCours.listerRecentsParUtilisateur(
        utilisateurId,
        JOURS_DE_TENDANCE
      );

      const parActif = new Map();
      for (const releve of releves) {
        const serie = parActif.get(releve.actif_id) ?? [];
        serie.push(releve);
        parActif.set(releve.actif_id, serie);
      }

      return new Map(
        [...parActif.entries()].map(([actifId, serie]) => [
          actifId,
          {
            variation: performanceSurPeriode(serie, 'cours_eur'),
            points: serie.map((point) => point.cours_eur),
          },
        ])
      );
    } catch (erreur) {
      // Une tendance absente n'empêche pas de lire son portefeuille : la colonne
      // affiche alors son état « pas assez de points », comme pour un actif trop jeune.
      console.error('Lecture des tendances impossible :', erreur.message);
      return new Map();
    }
  }

  async function obtenirDetailActif(actifId, utilisateurId) {
    const actif = await depotActifs.trouverParIdEtUtilisateur(actifId, utilisateurId);
    if (!actif) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }

    // Un seul déroulé sert les deux besoins de l'écran de détail : l'état courant de la
    // position, et l'effet de chaque mouvement sur le prix de revient. Les mouvements
    // sortent donc enrichis, dans l'ordre chronologique du calcul.
    const transactions = await depotTransactions.listerParActifEtUtilisateur(actifId, utilisateurId);
    const { mouvements, position } = derouler(transactions);

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
      transactions: mouvements,
      historique: await obtenirHistoriqueCours(actifId, utilisateurId),
      // Même taux que celui du portefeuille : la bascule euro/dollar ne déclenche aucune
      // requête sur l'écran de détail non plus.
      taux_affichage: await obtenirTauxAffichage(),
    };
  }

  // Historique de cours d'une position, avec la performance de chacune des plages du
  // sélecteur de période.
  //
  // La série entière part dans la réponse plutôt qu'une fenêtre à la demande : quatre-
  // vingt-dix points pèsent moins qu'un aller-retour, et changer de plage devient
  // immédiat. Les performances, elles, portent toujours sur l'historique complet, la
  // performance sur un an ne se déduisant pas d'une fenêtre d'une semaine.
  async function obtenirHistoriqueCours(actifId, utilisateurId) {
    try {
      const points = await snapshotsCours.listerParActif(actifId, utilisateurId);
      return { points, performances: calculerPerformances(points, 'cours_eur') };
    } catch (erreur) {
      // Un historique illisible ne prive pas l'utilisateur du reste de la fiche : le
      // graphe affiche alors son état « pas assez de points ».
      console.error("Lecture de l'historique de cours impossible :", erreur.message);
      return { points: [], performances: calculerPerformances([], 'cours_eur') };
    }
  }

  // Historique du portefeuille : les points de la plage demandée, et la performance de
  // chacune des plages du sélecteur.
  //
  // Les performances portent sur l'historique complet, pas sur la fenêtre demandée :
  // la performance depuis l'origine et celle sur un an ne se déduisent pas d'une
  // fenêtre d'une semaine. D'où le second chargement lorsqu'une fenêtre est demandée.
  async function obtenirHistorique(utilisateurId, nombreDeJours) {
    const points = await snapshots.listerParUtilisateur(utilisateurId, nombreDeJours);
    const complet = nombreDeJours
      ? await snapshots.listerParUtilisateur(utilisateurId)
      : points;

    return { points, performances: calculerPerformances(complet) };
  }

  // Valeurs actuelles observables pour l'écran Seuils : le cours de chaque position et
  // la valeur totale, sans aucun effet de bord.
  async function obtenirValeursObservees(utilisateurId) {
    const { positions, coursIndisponibles, capitalComplet } =
      await construirePositions(utilisateurId);
    const totaux = consolider(positions);

    const coursParActif = Object.fromEntries(
      positions.filter((position) => position.cours_eur !== null).map((p) => [p.id, p.cours_eur])
    );

    // La complétude accompagne le total partout : l'écran Seuils ne doit pas calculer
    // un écart sur un sous-total.
    return {
      capitalTotal: totaux.valeur_totale,
      capitalComplet,
      coursIndisponibles,
      coursParActif,
    };
  }

  return {
    obtenirPortefeuille,
    actualiserPortefeuille,
    obtenirDetailActif,
    obtenirHistorique,
    obtenirValeursObservees,
  };
}

module.exports = { creerServicePortefeuille };
