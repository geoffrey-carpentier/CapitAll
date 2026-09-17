import './Variation.css';
import {
  formaterVariation,
  amplitudeVariation,
  sensVariation,
  symboleDevise,
} from '../utils/formatage';

// Variation d'une position ou du portefeuille, en pourcentage ou en montant.
//
// L'information ne repose jamais sur la seule couleur : signe toujours écrit, flèche
// dès 1 %. Le poids visuel suit l'amplitude (voir Variation.css).

const FLECHES = {
  hausse: '▲',
  baisse: '▼',
};

// Le signe et la flèche ne se prononcent pas : le sens est dit en toutes lettres.
const SENS_PARLE = {
  hausse: 'en hausse de',
  baisse: 'en baisse de',
  stable: 'stable,',
};

export default function Variation({
  valeur,
  mode = 'relative',
  amplitude,
  devise = 'EUR',
  ...proprietes
}) {
  const texte = formaterVariation(valeur, mode, { symbole: symboleDevise(devise) });

  if (texte === null) {
    return (
      <span className="variation variation--indisponible" {...proprietes}>
        <span aria-hidden="true">—</span>
        <span className="lecteur-ecran-seulement">variation indisponible</span>
      </span>
    );
  }

  const sens = sensVariation(valeur);

  // Les amplitudes sont en pourcentage : en mode absolu, l'appelant fournit le
  // pourcentage correspondant, sinon le traitement discret s'applique.
  const reference = mode === 'absolue' ? amplitude : valeur;
  const niveau = amplitudeVariation(reference) ?? (sens === 'stable' ? 'nulle' : 'faible');

  const fleche = niveau === 'forte' || niveau === 'moyenne' ? FLECHES[sens] : null;

  // Libellé vocal : le sens en toutes lettres, puis la valeur sans signe.
  const libelle = `${SENS_PARLE[sens]} ${texte.replace(/^[+−]/, '')}`;

  return (
    <span
      className={`variation variation--${niveau} variation--${sens}`}
      aria-label={libelle}
      {...proprietes}
    >
      {fleche && (
        <span className="variation__fleche" aria-hidden="true">
          {fleche}
        </span>
      )}
      <span aria-hidden="true">{texte}</span>
    </span>
  );
}
