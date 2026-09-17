// Évaluation des alertes de seuil en fonctions pures, sans base ni effet de bord. Le
// chargement et le marquage des alertes relèvent du service de portefeuille.
//
// Aucune tâche de fond : l'évaluation a lieu à l'actualisation du tableau de bord, quand
// les valeurs viennent d'être calculées.

const {
  ECHELLE_PRIX,
  ECHELLE_MONTANT,
  ECHELLE_POURCENTAGE,
  versUnites,
  comparer,
  diviser,
  formater,
} = require('../utils/decimal');

// Franchissement inclusif : un seuil « au-dessus » de 70 000 se déclenche dès que la
// valeur atteint 70 000.
function estFranchi(sensSeuil, valeurObservee, valeurSeuil) {
  // L'échelle des prix couvre un cours comme un capital, et admet un seuil sous le
  // centime.
  const observee = versUnites(valeurObservee, ECHELLE_PRIX);
  const seuil = versUnites(valeurSeuil, ECHELLE_PRIX);
  const position = comparer(observee, seuil);

  return sensSeuil === 'au_dessus' ? position >= 0 : position <= 0;
}

// Valeur comparée au seuil : pour un actif, son cours courant et non la valeur de la
// position détenue (les deux diffèrent dès que la quantité n'est pas 1).
function valeurObservee(alerte, contexte) {
  if (alerte.type_cible === 'capital_total') {
    return contexte.capitalTotal ?? null;
  }

  return contexte.coursParActif?.[alerte.actif_id] ?? null;
}

// Écart restant avant franchissement, en pourcentage de la valeur observée : un seuil
// haut à 65 000 avec un cours à 61 240 rend 6,14. Un seuil déjà franchi rend 0.
// Calculé côté serveur, comme toute valeur dérivée d'un montant.
function ecartRestant(sensSeuil, valeurConstatee, valeurSeuil) {
  if (valeurConstatee === null || valeurConstatee === undefined || valeurConstatee === '') {
    return null;
  }

  const observee = versUnites(valeurConstatee, ECHELLE_PRIX);
  if (observee === 0n) {
    return null;
  }
  const seuil = versUnites(valeurSeuil, ECHELLE_PRIX);

  if (estFranchi(sensSeuil, valeurConstatee, valeurSeuil)) {
    return '0';
  }

  const ecart = seuil > observee ? seuil - observee : observee - seuil;
  const pourcentage = diviser(ecart * 100n, ECHELLE_PRIX, observee, ECHELLE_PRIX, ECHELLE_POURCENTAGE);

  return formater(pourcentage, ECHELLE_POURCENTAGE, ECHELLE_MONTANT);
}

function evaluerAlertes(alertesActives, contexte) {
  const franchissements = [];

  for (const alerte of alertesActives) {
    // Une alerte déclenchée n'est pas réévaluée : sa date de premier franchissement
    // serait écrasée.
    if (alerte.statut !== 'active') {
      continue;
    }

    const observee = valeurObservee(alerte, contexte);

    // Valeur inconnue : pas d'évaluation, plutôt qu'un déclenchement sur une donnée
    // absente.
    if (observee === null || observee === undefined || observee === '') {
      continue;
    }

    if (estFranchi(alerte.sens_seuil, observee, alerte.valeur_seuil)) {
      franchissements.push({
        id: alerte.id,
        type_cible: alerte.type_cible,
        actif_id: alerte.actif_id ?? null,
        symbole: alerte.symbole ?? null,
        sens_seuil: alerte.sens_seuil,
        valeur_seuil: alerte.valeur_seuil,
        valeur_observee: String(observee),
      });
    }
  }

  return franchissements;
}

module.exports = { evaluerAlertes, estFranchi, valeurObservee, ecartRestant };
