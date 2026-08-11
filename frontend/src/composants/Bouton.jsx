import './Bouton.css';

// Bouton de l'application. L'état d'envoi désactive le bouton et remplace son libellé,
// ce qui empêche une double soumission et rend l'attente visible.
export default function Bouton({
  children,
  variante = 'primaire',
  type = 'button',
  enCours = false,
  desactive = false,
  ...proprietes
}) {
  return (
    <button
      type={type}
      className={`bouton bouton--${variante}`}
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
