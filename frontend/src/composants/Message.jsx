import './Message.css';

// Bandeau de message (le terme « alerte » est réservé aux seuils).
//
// Le symbole double la couleur. Une erreur est annoncée immédiatement (role="alert") ;
// une information ou un avertissement n'interrompt pas.
//
// L'avertissement signale une donnée incomplète ou dégradée (cours absent ou de repli),
// qui n'est ni une panne ni une perte. Son demi-cercle est celui de la pastille de
// fraîcheur en état tiède.
const SYMBOLES = {
  erreur: '⚠',
  avertissement: '◐',
  information: 'ℹ',
};

export default function Message({ variante = 'information', children }) {
  return (
    <p
      className={`message message--${variante}`}
      role={variante === 'erreur' ? 'alert' : 'status'}
    >
      <span className="message__symbole" aria-hidden="true">
        {SYMBOLES[variante]}
      </span>
      <span>{children}</span>
    </p>
  );
}
