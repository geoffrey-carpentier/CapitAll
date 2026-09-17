import './MasquageMontants.css';

// Masque les montants de l'écran (consultation dans un lieu public) sans masquer la
// structure. Interrupteur à aria-pressed, dont l'état est annoncé à chaque activation.
export default function MasquageMontants({ masque = false, surChangement, ...proprietes }) {
  return (
    <button
      type="button"
      className="masquage-montants"
      aria-pressed={masque}
      aria-label={masque ? 'Afficher les montants' : 'Masquer les montants'}
      onClick={() => surChangement?.(!masque)}
      {...proprietes}
    >
      <span aria-hidden="true">{masque ? '☰' : '◉'}</span>
    </button>
  );
}
