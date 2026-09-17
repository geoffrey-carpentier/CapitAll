// Fenêtre d'une plage dans la série d'instantanés déjà reçue, sans requête au serveur.
//
// La fenêtre se compte en jours et non en points : la série est trouée (pas de point les
// jours sans consultation), et `slice(-n)` pourrait couvrir plusieurs semaines.
//
// Elle part du dernier point et non d'aujourd'hui, comme le calcul des performances côté
// serveur : courbe et pourcentage portent ainsi sur les mêmes points.

// Date reculée d'un nombre de jours. Date.UTC évite le décalage d'un jour que produirait
// l'analyse d'une date seule dans le fuseau local.
export function reculerDe(dateIso, jours) {
  const [annee, mois, jour] = dateIso.split('-');
  const instant = Date.UTC(Number(annee), Number(mois) - 1, Number(jour) - jours);
  return new Date(instant).toISOString().slice(0, 10);
}

// `jours` absent ou nul rend la série entière (plage « depuis l'origine »).
export function fenetreDePeriode(points, jours, champDate = 'date_snapshot') {
  if (!Array.isArray(points) || points.length === 0 || !jours) {
    return points ?? [];
  }

  const derniereDate = points[points.length - 1][champDate];

  if (!derniereDate) {
    return points;
  }

  const debut = reculerDe(derniereDate, jours);

  // Au format AAAA-MM-JJ, l'ordre lexicographique est l'ordre chronologique.
  return points.filter((point) => point[champDate] >= debut);
}
