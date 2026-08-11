import './PastilleFraicheur.css';
import { formaterAnciennete } from '../utils/duree';

// Ancienneté et provenance d'un cours.
//
// Deux états seulement, et ils ne se déduisent pas d'une horloge : un cours est à jour,
// ou bien il provient du dernier cours connu parce que le fournisseur n'a pas répondu.
// C'est le repli signalé par la réponse de l'API, la seule distinction que la
// spécification nomme. Aucun seuil de durée n'est inventé ici : la pastille rend compte
// d'un fait transmis par le serveur, elle ne le décide pas.
//
// La couleur ne porte rien seule : l'état tiède ajoute un symbole et l'ancienneté est
// écrite en toutes lettres.

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
