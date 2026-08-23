import './Repartition.css';
import Montant from './Montant';
import JetonClasse from './JetonClasse';
import { formaterPourcentage } from '../utils/formatage';

// Répartition du patrimoine par classe d'actif, en liste chiffrée.
//
// Il n'y a volontairement aucun graphique. La visualisation en anneau a été retirée aux
// deux points de rupture (D74) : distinguer quatre segments demandait soit quatre
// couleurs nouvelles, ce que la palette interdit, soit les couleurs sémantiques, ce qui
// aurait fait passer une classe d'actif pour un gain et une autre pour une perte. Les
// niveaux d'opacité, mesurés, ne tenaient pas le contraste sur le plus clair des
// segments.
//
// Rien de la donnée n'est perdu pour autant : les quatre catégories, les montants et
// les parts restent tous affichés. La liste est d'ailleurs ce que la légende de
// l'anneau donnait déjà à lire, et elle se restitue à la voix sans description à
// rallonge. La classe reste portée par la forme du jeton (D76), jamais par une pastille
// de couleur.
export default function Repartition({ repartition = [], devise = 'EUR', masque = false }) {
  return (
    <ul className="repartition">
      {repartition.map((part) => (
        <li key={part.type} className="repartition__entree">
          <JetonClasse classe={part.type} avecLibelle />
          <span className="repartition__part">{formaterPourcentage(part.pourcentage)}</span>
          <span className="repartition__valeur">
            {masque ? (
              <span aria-label="Montant masqué">••••</span>
            ) : (
              <Montant valeur={part.valeur} devise={devise} />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
