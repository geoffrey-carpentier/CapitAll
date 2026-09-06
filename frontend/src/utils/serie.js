// Découpage d'une série d'instantanés selon la plage choisie.
//
// La série entière arrive dans la réponse, et c'est ici qu'on en garde une fenêtre.
// Auparavant, changer de plage sur le tableau de bord rechargeait le portefeuille entier
// en plus de l'historique : cinq clics d'exploration valaient cinq consolidations
// complètes, alors que seul l'affichage changeait.
//
// LA FENÊTRE SE COMPTE EN JOURS, PAS EN POINTS. Découper par `slice(-n)` supposerait une
// série journalière continue. Elle ne l'est pas : le point du jour n'existe que si
// l'utilisateur a consulté, et il n'est pas écrit du tout quand une position détenue n'a
// pas de cours. Sept points peuvent donc couvrir trois semaines, et la courbe annoncerait
// « Semaine » sur un mois.
//
// LE POINT DE DÉPART EST LE DERNIER POINT, PAS AUJOURD'HUI. C'est la règle qu'applique le
// serveur pour calculer les performances de chaque plage. Prendre la date du jour ici
// ferait porter la courbe et le pourcentage affiché juste au-dessus sur deux ensembles de
// points différents, ce qui se lirait comme une erreur de calcul.

// Date reculée d'un nombre de jours, en UTC et par composants.
//
// Passer par Date.UTC plutôt que par l'analyse d'une chaîne évite le décalage d'un jour
// qu'introduit l'interprétation d'une date seule dans le fuseau local.
export function reculerDe(dateIso, jours) {
  const [annee, mois, jour] = dateIso.split('-');
  const instant = Date.UTC(Number(annee), Number(mois) - 1, Number(jour) - jours);
  return new Date(instant).toISOString().slice(0, 10);
}

// Points de la plage demandée. `jours` absent ou nul rend la série entière : c'est la
// plage « depuis l'origine ».
export function fenetreDePeriode(points, jours, champDate = 'date_snapshot') {
  if (!Array.isArray(points) || points.length === 0 || !jours) {
    return points ?? [];
  }

  const derniereDate = points[points.length - 1][champDate];

  if (!derniereDate) {
    return points;
  }

  const debut = reculerDe(derniereDate, jours);

  // Les dates sont au format AAAA-MM-JJ : leur ordre lexicographique est leur ordre
  // chronologique, aucune conversion n'est nécessaire pour filtrer.
  return points.filter((point) => point[champDate] >= debut);
}
