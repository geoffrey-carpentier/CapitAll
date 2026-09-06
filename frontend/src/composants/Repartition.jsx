import { Link } from 'react-router-dom';
import './Repartition.css';
import Montant from './Montant';
import JetonClasse from './JetonClasse';
import { formaterPourcentage } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';

// Répartition du patrimoine par classe d'actif : un anneau, puis la liste chiffrée.
//
// L'anneau avait été retiré en D74, faute d'une quatrième teinte disponible : la version
// d'alors réemployait les couleurs sémantiques, ce qui faisait passer une classe pour un
// avertissement et une autre pour une perte, et le repli par niveaux d'opacité ne
// séparait les segments qu'à 1,46:1. D98 le rétablit sur quatre couleurs dédiées, hors
// palette sémantique et mesurées ensemble (jetons --couleur-classe-*).
//
// La règle qui commandait D74 tient toujours et n'est pas contournée : l'information ne
// repose pas sur la couleur. L'anneau est décoratif au sens strict — il porte
// aria-hidden, et la liste qui le suit dit tout ce qu'il montre, libellé, part et
// montant, avec la forme du jeton comme second repère (D76). Un lecteur d'écran, un
// affichage en niveaux de gris ou une impression noir et blanc ne perdent rien.
//
// Chaque entrée est un lien vers l'écran Positions, filtré sur sa classe. La répartition
// pose la question « qu'est-ce qui pèse le plus », et la réponse suivante est toujours
// « de quoi cette part est-elle faite » : la faire suivre d'un retour à la navigation
// puis d'un filtre à poser à la main revient à interrompre la lecture au moment où elle
// devient intéressante. Le filtre est celui que l'écran Positions lit déjà dans
// l'adresse, aucun mécanisme nouveau n'est introduit.

const RAYON = 52;
const EPAISSEUR = 16;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

// Séparation de 2 px entre deux segments, tracée dans le vide plutôt qu'au pinceau :
// c'est le fond de la carte qui passe, aucune couleur n'est ajoutée pour cela.
const SEPARATION = 2;

// La part arrive du serveur en chaîne décimale. Elle ne sert ici qu'à une longueur en
// pixels : la convertir en nombre ne coûte aucune précision utile, contrairement aux
// montants, qui restent des chaînes jusqu'au composant Montant.
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

          // Un segment plus court que sa propre séparation disparaîtrait entièrement :
          // il garde alors un trait, quitte à ce que le vide soit plus étroit.
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
