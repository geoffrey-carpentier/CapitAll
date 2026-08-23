// Échelle verticale d'une courbe de cours, et position de la bascule de teinte.
//
// Sorti du composant pour deux raisons. La première est qu'il s'agit de géométrie pure,
// qui se vérifie par le calcul sans avoir à faire tracer un graphique : sous jsdom, la
// bibliothèque de tracé ne mesure aucun conteneur et ne produit donc aucun élément à
// inspecter. La seconde est qu'un module exportant à la fois un composant et des
// fonctions empêche le rechargement à chaud de fonctionner.
//
// Ces valeurs sont des pixels et des proportions, jamais des montants : c'est le seul
// endroit du dossier où des nombres flottants sont légitimes.

// Bornes verticales du tracé, prix de revient inclus.
export function bornes(hauteurs, seuil) {
  return [Math.min(...hauteurs, seuil), Math.max(...hauteurs, seuil)];
}

// Position du prix de revient dans le cadre, de haut en bas, entre 0 et 1. C'est là que
// le dégradé bascule du positif au négatif. Rend null quand il n'y a pas de bascule à
// placer, auquel cas l'aire garde une teinte unique.
export function hauteurDeBascule(hauteurs, seuil) {
  if (hauteurs.length === 0 || seuil === null || Number.isNaN(seuil)) {
    return null;
  }

  const [bas, haut] = bornes(hauteurs, seuil);

  // Série parfaitement plate confondue avec le prix de revient : aucune bascule, et
  // surtout aucune division par zéro.
  if (haut === bas) {
    return null;
  }

  return (haut - seuil) / (haut - bas);
}
