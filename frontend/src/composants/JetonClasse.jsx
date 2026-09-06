import './JetonClasse.css';
import { CLASSES_QUANTITE } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';

// Marqueur visuel de la classe d'un actif.
//
// La classe se distingue d'abord par la forme, cercle, carré arrondi, losange ou
// hexagone, et non par la couleur : le repère survit ainsi à un affichage en niveaux de
// gris comme à un daltonisme. C'est la règle posée par la direction artistique.
//
// La forme seule ne se prononce pas : le nom de la classe accompagne toujours le jeton,
// visible lorsque l'appelant le demande, restitué à la voix dans tous les cas.

function monogramme(classe, symbole) {
  if (!symbole) return '';
  const connus = { BTC: '₿', ETH: 'Ξ', XAU: 'Au', XAG: 'Ag', USD: '$', EUR: '€' };
  return connus[symbole] ?? (classe === 'action' ? symbole.slice(0, 1) : symbole.slice(0, 2));
}

export default function JetonClasse({ classe, symbole, avecLibelle = false, ...proprietes }) {
  if (!CLASSES_QUANTITE.includes(classe)) {
    return null;
  }

  const libelle = LIBELLES_CLASSE[classe];

  return (
    <span className="jeton-classe" {...proprietes}>
      <span
        className={`jeton-classe__forme jeton-classe__forme--${classe}${symbole ? ' jeton-classe__forme--actif' : ''}`}
        data-symbole={symbole}
        aria-hidden="true"
      >
        {monogramme(classe, symbole)}
      </span>
      <span className={avecLibelle ? 'jeton-classe__libelle' : 'lecteur-ecran-seulement'}>
        {libelle}
      </span>
    </span>
  );
}
