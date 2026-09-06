import './Variation.css';
import {
  formaterVariation,
  amplitudeVariation,
  sensVariation,
  symboleDevise,
} from '../utils/formatage';

// Variation d'une position ou du portefeuille, en pourcentage ou en euros.
//
// Accessibilité, règle non négociable de la politique de formatage : l'information
// n'est jamais portée par la couleur seule. Le signe est toujours écrit, la flèche
// accompagne toute variation d'au moins un pour cent, et la valeur reste donc lisible
// en niveaux de gris comme par un utilisateur daltonien.
//
// Le poids visuel suit l'amplitude, pour qu'une page entière ne crie pas d'une seule
// voix : pastille pleine au-delà de dix pour cent, texte coloré entre un et dix,
// texte atténué en deçà.

const FLECHES = {
  hausse: '▲',
  baisse: '▼',
};

// Le libellé vocal ne peut pas se contenter du signe et de la flèche, qui ne se
// prononcent pas : il énonce le sens en toutes lettres.
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

  // Le tableau des amplitudes s'exprime en pourcentage. En mode absolu, la valeur
  // affichée est un montant : l'amplitude relative correspondante doit alors être
  // fournie par l'appelant, qui dispose des deux chiffres. À défaut, la variation
  // reste lisible mais adopte le traitement discret, jamais la pastille pleine.
  const reference = mode === 'absolue' ? amplitude : valeur;
  const niveau = amplitudeVariation(reference) ?? (sens === 'stable' ? 'nulle' : 'faible');

  const fleche = niveau === 'forte' || niveau === 'moyenne' ? FLECHES[sens] : null;

  // Le signe typographique et la flèche ne se prononcent pas : le libellé vocal reprend
  // le sens en toutes lettres puis la valeur nue, sans son signe.
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
