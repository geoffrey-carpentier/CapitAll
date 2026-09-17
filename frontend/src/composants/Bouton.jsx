import './Bouton.css';

// Bouton de l'application. En cours d'envoi, il est désactivé et change de libellé, ce
// qui empêche une double soumission.
export default function Bouton({
  children,
  variante = 'primaire',
  type = 'button',
  enCours = false,
  desactive = false,
  // Classe d'appoint ajoutée aux classes du composant, sans les remplacer.
  className = '',
  ...proprietes
}) {
  return (
    <button
      type={type}
      className={`bouton bouton--${variante}${className ? ` ${className}` : ''}`}
      disabled={desactive || enCours}
      aria-busy={enCours || undefined}
      {...proprietes}
    >
      {enCours ? 'Envoi en cours…' : children}
    </button>
  );
}
