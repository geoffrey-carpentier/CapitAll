// Évaluation des alertes de seuil, en fonction pure : elle reçoit les alertes actives
// et un contexte de valeurs observées, elle rend la liste des franchissements. Aucune
// base, aucun appel de cours, aucun effet de bord. Le chargement des alertes et leur
// marquage relèvent du service de portefeuille.
//
// Aucune tâche de fond n'évalue les alertes (D50) : l'évaluation a lieu au chargement
// du tableau de bord, quand les valeurs viennent d'être calculées.

const { ECHELLE_PRU, versUnites, comparer } = require('../utils/decimal');

// Franchissement inclusif (D56) : un seuil « au-dessus » de 70 000 se déclenche
// lorsque la valeur atteint 70 000, pas seulement lorsqu'elle le dépasse. C'est ce
// qu'attend l'utilisateur qui a fixé ce seuil.
function estFranchi(sensSeuil, valeurObservee, valeurSeuil) {
  const observee = versUnites(valeurObservee, ECHELLE_PRU);
  const seuil = versUnites(valeurSeuil, ECHELLE_PRU);
  const position = comparer(observee, seuil);

  return sensSeuil === 'au_dessus' ? position >= 0 : position <= 0;
}

// Valeur à comparer au seuil, selon la cible de l'alerte.
//
// Pour une alerte sur un actif, c'est le COURS COURANT de cet actif, et non la valeur
// de la position détenue. Un seuil de prix porte sur le prix : un utilisateur qui
// demande à être prévenu quand le bitcoin atteint 70 000 euros parle du cours, pas de
// ce que vaut son portefeuille de bitcoins. Les deux diffèrent dès que la quantité
// détenue n'est pas exactement 1, et un test couvre précisément ce cas.
function valeurObservee(alerte, contexte) {
  if (alerte.type_cible === 'capital_total') {
    return contexte.capitalTotal ?? null;
  }

  return contexte.coursParActif?.[alerte.actif_id] ?? null;
}

function evaluerAlertes(alertesActives, contexte) {
  const franchissements = [];

  for (const alerte of alertesActives) {
    // Une alerte déjà déclenchée n'est pas réévaluée (D56) : sa date de premier
    // franchissement est l'information utile, la réévaluer l'écraserait.
    if (alerte.statut !== 'active') {
      continue;
    }

    const observee = valeurObservee(alerte, contexte);

    // Cours indisponible : l'alerte n'est pas évaluée du tout. Déclencher sur une
    // valeur inconnue, ou la traiter comme nulle, serait le pire des comportements.
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

module.exports = { evaluerAlertes, estFranchi };
