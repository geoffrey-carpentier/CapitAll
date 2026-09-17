// Échelle verticale d'une courbe et position de la bascule de teinte.
//
// Géométrie pure, sortie du composant pour être testée sans tracé (jsdom ne mesure pas
// les conteneurs) et pour préserver le rechargement à chaud. Ces nombres sont des
// proportions, jamais des montants : les flottants y sont légitimes.

// Bornes verticales du tracé, prix de revient inclus.
export function bornes(hauteurs, seuil) {
  return [Math.min(...hauteurs, seuil), Math.max(...hauteurs, seuil)];
}

// Position du prix de revient dans le cadre, de 0 (haut) à 1 (bas), où bascule le
// dégradé. null si aucune bascule : l'aire garde une teinte unique.
export function hauteurDeBascule(hauteurs, seuil) {
  if (hauteurs.length === 0 || seuil === null || Number.isNaN(seuil)) {
    return null;
  }

  const [bas, haut] = bornes(hauteurs, seuil);

  // Série plate confondue avec le prix de revient : pas de division par zéro.
  if (haut === bas) {
    return null;
  }

  return (haut - seuil) / (haut - bas);
}
