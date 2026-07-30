// Logique métier des alertes : aiguillage entre les deux cibles et traduction des
// absences en erreurs métier. Les règles de franchissement vivent dans
// evaluationAlertes.js, qui reste pur.

const modeleAlerte = require('../models/alerte');
const { ErreurIntrouvable } = require('../erreurs');

async function creer({ utilisateurId, donnees }) {
  if (donnees.type_cible === 'capital_total') {
    return modeleAlerte.creerSurCapitalTotal({
      utilisateurId,
      sensSeuil: donnees.sens_seuil,
      valeurSeuil: donnees.valeur_seuil,
    });
  }

  const alerte = await modeleAlerte.creerSurActif({
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
  const alerte = await modeleAlerte.desactiver(id, utilisateurId);

  if (!alerte) {
    throw new ErreurIntrouvable('Alerte introuvable.');
  }

  return alerte;
}

async function lister(utilisateurId) {
  return modeleAlerte.listerParUtilisateur(utilisateurId);
}

module.exports = { creer, desactiver, lister };
