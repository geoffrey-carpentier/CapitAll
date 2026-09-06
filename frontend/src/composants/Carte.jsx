import './Carte.css';

// Conteneur standard de l'interface. Le titre est optionnel : lorsqu'il est fourni,
// il est rendu comme un véritable en-tête et non comme un simple texte en gras, afin
// que la structure du document reste navigable.
export default function Carte({ titre, action, className = '', children, ...proprietes }) {
  return (
    // La classe reçue s'ajoute à celle du composant : la remplacer ferait perdre le
    // fond, la bordure et le rayon de la carte au premier appelant qui la positionne.
    <section className={`carte${className ? ` ${className}` : ''}`} {...proprietes}>
      {(titre || action) && (
        <header className="carte__entete">
          {titre && <h2 className="carte__titre">{titre}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
