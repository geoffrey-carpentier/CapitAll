// Logique métier des alertes : aiguillage entre les deux cibles, traduction des
// absences en erreurs métier, et enrichissement de la liste par l'écart restant avant
// franchissement. Les règles de franchissement et l'écart lui-même vivent dans
// evaluationAlertes.js, qui reste pur ; ce module est celui qui les alimente en
// valeurs réelles.
//
// Comme les services du portefeuille, de l'authentification et des transactions, le
// service reçoit ses dépendances en paramètre : il s'exécute alors sans base ni réseau
// dans les tests, avec le même code qu'en production.

const modeleAlerte = require('../models/alerte');
const { creerServicePortefeuille } = require('./portefeuilleConsolide');
const { valeurObservee, ecartRestant } = require('./evaluationAlertes');
const { ErreurIntrouvable } = require('../erreurs');

function creerServiceAlerte({
  alertes: depotAlertes = modeleAlerte,
  servicePortefeuille = creerServicePortefeuille(),
} = {}) {
  async function creer({ utilisateurId, donnees }) {
    if (donnees.type_cible === 'capital_total') {
      return depotAlertes.creerSurCapitalTotal({
        utilisateurId,
        sensSeuil: donnees.sens_seuil,
        valeurSeuil: donnees.valeur_seuil,
      });
    }

    const alerte = await depotAlertes.creerSurActif({
      utilisateurId,
      actifId: donnees.actif_id,
      sensSeuil: donnees.sens_seuil,
      valeurSeuil: donnees.valeur_seuil,
    });

    // Aucune ligne insérée : l'actif n'existe pas ou appartient à quelqu'un d'autre.
    // Les deux cas sont indiscernables pour l'appelant, conformément à D52.
    if (!alerte) {
      throw new ErreurIntrouvable('Actif introuvable.');
    }

    return alerte;
  }

  async function desactiver({ id, utilisateurId }) {
    const alerte = await depotAlertes.desactiver(id, utilisateurId);

    if (!alerte) {
      throw new ErreurIntrouvable('Alerte introuvable.');
    }

    return alerte;
  }

  // Liste des alertes, chacune enrichie de la valeur actuellement observée sur sa
  // cible et de l'écart restant avant franchissement, en pourcentage (E6, D69) : ce
  // sont des valeurs dérivées d'un montant, elles ne se recalculent pas côté
  // interface. Un cours indisponible sur la cible rend les deux champs nuls plutôt
  // qu'une valeur inventée ; l'écran affiche alors une mention explicite.
  async function lister(utilisateurId) {
    const alertesUtilisateur = await depotAlertes.listerParUtilisateur(utilisateurId);

    if (alertesUtilisateur.length === 0) {
      return [];
    }

    const { capitalTotal, coursParActif } = await servicePortefeuille.obtenirValeursObservees(
      utilisateurId
    );

    return alertesUtilisateur.map((alerte) => {
      const observee = valeurObservee(alerte, { capitalTotal, coursParActif });

      return {
        ...alerte,
        valeur_observee: observee !== null && observee !== undefined ? String(observee) : null,
        ecart_pourcentage: ecartRestant(alerte.sens_seuil, observee, alerte.valeur_seuil),
      };
    });
  }

  return { creer, desactiver, lister };
}

module.exports = { creerServiceAlerte };
