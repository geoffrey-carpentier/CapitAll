import './Bouton.css';

// Bouton de l'application. L'état d'envoi désactive le bouton et remplace son libellé,
// ce qui empêche une double soumission et rend l'attente visible.
export default function Bouton({
  children,
  variante = 'primaire',
  type = 'button',
  enCours = false,
  desactive = false,
  // Classe d'appoint, fusionnée plutôt qu'écrasante : une feuille d'écran a parfois
  // besoin de désigner un bouton précis de sa barre d'outils, et un sélecteur portant
  // sur la classe générique en atteindrait tous les autres au passage.
  className = '',
  ...proprietes
}) {
  return (
    <button
      type={type}
      className={`bouton bouton--${variante}${className ? ` ${className}` : ''}`}
      disabled={desactive || enCours}
      // Annonce l'attente aux technologies d'assistance, que le libellé visuel
      // change ou non.
      aria-busy={enCours || undefined}
      {...proprietes}
    >
      {enCours ? 'Envoi en cours…' : children}
    </button>
  );
}
