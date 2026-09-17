import './PastilleFraicheur.css';
import { formaterAnciennete } from '../utils/duree';

// Ancienneté et provenance d'un cours, en deux états : à jour ou dernier cours connu.
//
// L'état n'est jamais déduit d'un seuil d'ancienneté côté client : la durée de vie du
// cache varie selon la classe d'actif, et seul le serveur sait qu'un cours vient du
// repli. Le composant affiche ce fait sans le décider.
//
// L'état tiède ajoute un symbole et l'ancienneté est écrite : la couleur ne porte rien
// seule.

export default function PastilleFraicheur({ source, horodatage, enRepli = false, ...proprietes }) {
  const anciennete = formaterAnciennete(horodatage);
  const etat = enRepli ? 'tiede' : 'actuel';

  const description = enRepli
    ? `Dernier cours connu${source ? `, source ${source}` : ''}${anciennete ? `, ${anciennete}` : ''}`
    : `Cours à jour${source ? `, source ${source}` : ''}${anciennete ? `, ${anciennete}` : ''}`;

  return (
    <span
      className={`pastille-fraicheur pastille-fraicheur--${etat}`}
      aria-label={description}
      {...proprietes}
    >
      <span className="pastille-fraicheur__marque" aria-hidden="true">
        {enRepli ? '◐' : '●'}
      </span>
      <span aria-hidden="true">
        {source}
        {source && anciennete ? ' · ' : ''}
        {anciennete}
      </span>
    </span>
  );
}
