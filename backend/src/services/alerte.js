// Service des alertes : création selon la cible, désactivation, et liste enrichie des
// valeurs observées. Les règles de calcul restent dans evaluationAlertes.js (pur).
// Dépendances injectées pour tester sans base ni réseau.

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

    // Aucune ligne insérée : actif inexistant ou d'un autre compte, cas indiscernables.
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

  // Chaque alerte reçoit la valeur observée et l'écart restant en pourcentage, calculés
  // ici plutôt que dans l'interface. Sans cours, les deux valent null.
  async function lister(utilisateurId) {
    const alertesUtilisateur = await depotAlertes.listerParUtilisateur(utilisateurId);

    if (alertesUtilisateur.length === 0) {
      return [];
    }

    const { capitalTotal, capitalComplet, coursParActif } =
      await servicePortefeuille.obtenirValeursObservees(utilisateurId);

    return alertesUtilisateur.map((alerte) => {
      // Un capital incomplet (position sans cours) est traité comme indisponible, pour
      // ne pas calculer l'écart contre un sous-total.
      const observee = valeurObservee(alerte, {
        capitalTotal: capitalComplet ? capitalTotal : null,
        coursParActif,
      });

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
