import './Carte.css';

// Conteneur standard de l'interface. Le titre est optionnel : lorsqu'il est fourni,
// il est rendu comme un véritable en-tête et non comme un simple texte en gras, afin
// que la structure du document reste navigable.
export default function Carte({ titre, action, children, ...proprietes }) {
  return (
    <section className="carte" {...proprietes}>
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
