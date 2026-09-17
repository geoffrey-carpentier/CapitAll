import { Link } from 'react-router-dom';
import './Repartition.css';
import Montant from './Montant';
import JetonClasse from './JetonClasse';
import { formaterPourcentage } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';

// Répartition du patrimoine par classe d'actif : un anneau, puis la liste chiffrée.
//
// L'anneau utilise des couleurs dédiées aux classes, hors palette sémantique, pour
// qu'une classe ne se lise pas comme une perte ou un avertissement. Il reste décoratif
// (aria-hidden) : la liste porte libellé, part et montant, et la forme du jeton double
// la couleur.
//
// Chaque entrée renvoie vers l'écran Positions filtré sur sa classe.

const RAYON = 52;
const EPAISSEUR = 16;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

// Vide de 2 px entre deux segments, laissant voir le fond de la carte.
const SEPARATION = 2;

// La part n'est convertie en nombre que pour une longueur en pixels ; les montants
// restent des chaînes.
function longueurArc(pourcentage) {
  const part = Number(pourcentage);
  return Number.isFinite(part) && part > 0 ? (part / 100) * CIRCONFERENCE : 0;
}

function Anneau({ repartition }) {
  let parcouru = 0;

  return (
    <svg
      className="repartition__anneau"
      viewBox="0 0 120 120"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-90 60 60)">
        {repartition.map((part) => {
          const arc = longueurArc(part.pourcentage);
          const decalage = parcouru;
          parcouru += arc;

          if (arc <= 0) {
            return null;
          }

          // Un segment plus court que la séparation garde au moins un trait visible.
          const trace = Math.max(arc - SEPARATION, 1);

          return (
            <circle
              key={part.type}
              className={`repartition__segment repartition__segment--${part.type}`}
              cx="60"
              cy="60"
              r={RAYON}
              fill="none"
              strokeWidth={EPAISSEUR}
              strokeDasharray={`${trace} ${CIRCONFERENCE - trace}`}
              strokeDashoffset={-decalage}
            />
          );
        })}
      </g>
    </svg>
  );
}

export default function Repartition({ repartition = [], devise = 'EUR', masque = false }) {
  return (
    <div className="repartition">
      <Anneau repartition={repartition} />
      <ul className="repartition__liste">
        {repartition.map((part) => (
          <li key={part.type}>
            <Link
              to={`/positions?classes=${part.type}`}
              className="repartition__entree"
              aria-label={`Voir les positions de la classe ${LIBELLES_CLASSE[part.type] ?? part.type}`}
            >
              <JetonClasse classe={part.type} avecLibelle />
              <span className="repartition__part">{formaterPourcentage(part.pourcentage)}</span>
              <span className="repartition__valeur">
                {masque ? (
                  <span aria-label="Montant masqué">••••</span>
                ) : (
                  <Montant valeur={part.valeur} devise={devise} />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
