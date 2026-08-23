import './CourbeMiniature.css';
import Variation from './Variation';
import { sensVariation } from '../utils/formatage';

// Tendance récente d'une position, dans une cellule de tableau.
//
// Tracée à la main en SVG plutôt qu'avec la bibliothèque de graphiques : une polyligne
// de trente points n'a besoin ni d'axes, ni d'échelle affichée, ni d'infobulle, et
// charger trois cents kilooctets de bibliothèque pour la dessiner dans une colonne de
// quatre-vingt-dix pixels serait hors de proportion.
//
// La courbe ne porte jamais l'information seule : la variation chiffrée l'accompagne,
// et c'est elle que lit un lecteur d'écran. Le tracé est décoratif au sens strict, il
// donne la forme du mouvement, pas sa mesure. Une cellule qui ne contiendrait que le
// dessin serait vide pour qui ne le voit pas.
//
// Les conversions numériques ci-dessous produisent des coordonnées en pixels. Aucune
// n'aboutit à une valeur affichée : la variation vient du serveur et passe par le
// module de formatage comme partout ailleurs.

const LARGEUR = 80;
const HAUTEUR = 24;
const MARGE = 2;

function trace(points) {
  const hauteurs = points.map(Number).filter(Number.isFinite);

  if (hauteurs.length < 2) {
    return null;
  }

  const minimum = Math.min(...hauteurs);
  const maximum = Math.max(...hauteurs);
  const amplitude = maximum - minimum;
  const utile = HAUTEUR - 2 * MARGE;

  return hauteurs
    .map((hauteur, index) => {
      const x = (index / (hauteurs.length - 1)) * LARGEUR;
      // Une série parfaitement plate n'a pas d'amplitude : elle se trace au milieu du
      // cadre plutôt que de provoquer une division par zéro.
      const y =
        amplitude === 0
          ? HAUTEUR / 2
          : HAUTEUR - MARGE - ((hauteur - minimum) / amplitude) * utile;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function CourbeMiniature({ tendance }) {
  const chemin = tendance ? trace(tendance.points ?? []) : null;

  // Une position trop jeune n'a pas assez de points. Tracer une ligne plate reviendrait
  // à affirmer une stagnation qui n'a pas été constatée.
  if (chemin === null) {
    return (
      <span className="courbe-miniature courbe-miniature--absente">
        <span aria-hidden="true">—</span>
        <span className="lecteur-ecran-seulement">tendance indisponible, historique trop court</span>
      </span>
    );
  }

  return (
    <span className="courbe-miniature">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        width={LARGEUR}
        height={HAUTEUR}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={chemin}
          fill="none"
          strokeWidth="1.5"
          // Le sens vient du module de formatage, seul juge du signe d'un montant,
          // et non d'une comparaison improvisée ici.
          className={`courbe-miniature__trace courbe-miniature__trace--${
            sensVariation(tendance.variation) ?? 'stable'
          }`}
        />
      </svg>
      <Variation valeur={tendance.variation} />
    </span>
  );
}
