import './Carte.css';

// Conteneur standard. Le titre facultatif est un vrai en-tête, pour la navigation par
// titres.
export default function Carte({ titre, action, className = '', children, ...proprietes }) {
  return (
    // La classe reçue s'ajoute à celle du composant, sans la remplacer.
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
