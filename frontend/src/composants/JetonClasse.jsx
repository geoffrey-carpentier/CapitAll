import './JetonClasse.css';
import { CLASSES_QUANTITE } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';

// Marqueur de la classe d'un actif, distinguée d'abord par la forme (cercle, carré
// arrondi, losange, hexagone) et non par la couleur.
//
// Le nom de la classe est toujours présent : visible sur demande, sinon réservé aux
// lecteurs d'écran.

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
