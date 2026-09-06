import './MasquageMontants.css';

// Bascule de confidentialité : masque tous les montants de l'écran.
//
// Le besoin est concret et fréquent, consulter son patrimoine dans un lieu public. Le
// masquage porte sur les valeurs, pas sur la structure : la composition reste visible,
// ce qui évite l'effet de page vide et permet de repérer une position sans exposer son
// montant.
//
// aria-pressed plutôt qu'une case à cocher : c'est un interrupteur d'affichage, pas la
// saisie d'une donnée. Son état est ainsi annoncé à chaque activation.
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
