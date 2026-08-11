import './PastilleFraicheur.css';
import { formaterAnciennete } from '../utils/duree';

// Ancienneté et provenance d'un cours.
//
// Deux états seulement, et ils ne se déduisent jamais d'un seuil d'ancienneté calculé
// ici. La raison tient à la durée de vie du cache, qui est différenciée par classe côté
// serveur : deux minutes pour une cryptomonnaie, cinq pour une action, dix pour un
// métal, une heure pour une devise. Un cours de métal vieux de quatre minutes est donc
// parfaitement frais là où un cours de crypto du même âge ne l'est plus. Un seuil unique
// appliqué côté client se tromperait sur trois classes sur quatre, et reproduire les
// quatre durées ici les dédoublerait, avec la certitude qu'elles divergent un jour.
//
// Le serveur est seul à pouvoir trancher, et il le fait déjà : la réponse du
// portefeuille énumère dans cours_indisponibles les actifs servis depuis le dernier
// cours connu. La pastille rend compte de ce fait, elle ne le décide pas. Deux états,
// jamais trois.
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
