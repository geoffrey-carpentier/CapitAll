import './Chargement.css';

// Indicateur d'attente. Le libellé est réservé aux lecteurs d'écran : à l'œil, le
// mouvement suffit ; à la voix, un point animé ne dit rien.
export default function Chargement({ libelle = 'Chargement en cours' }) {
  return (
    <div className="chargement" role="status">
      <span className="chargement__point" aria-hidden="true" />
      <span className="lecteur-ecran-seulement">{libelle}</span>
    </div>
  );
}
