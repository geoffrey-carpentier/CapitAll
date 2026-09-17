import './CourbeMiniature.css';
import Variation from './Variation';
import { sensVariation } from '../utils/formatage';

// Tendance sur trente jours dans une cellule de tableau.
//
// Tracée à la main en SVG : une polyligne sans axes ne justifie pas de charger la
// bibliothèque de graphiques. Le tracé est décoratif (aria-hidden) ; la variation
// chiffrée l'accompagne. Les conversions numériques ne servent qu'aux coordonnées.

const LARGEUR = 120;
// Reste inférieure à la hauteur d'une ligne de tableau.
const HAUTEUR = 32;
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
      // Série plate : tracée au milieu, sans division par zéro.
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

  // Historique trop court : pas de ligne plate, qui ferait croire à une stagnation.
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
          className={`courbe-miniature__trace courbe-miniature__trace--${
            sensVariation(tendance.variation) ?? 'stable'
          }`}
        />
      </svg>
      <Variation valeur={tendance.variation} />
    </span>
  );
}
