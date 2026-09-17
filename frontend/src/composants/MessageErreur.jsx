import './MessageErreur.css';
import Bouton from './Bouton';

// Erreur présentée en clair, avec l'action qui permet d'en sortir.
//
// Quatre natures, qui n'appellent pas le même geste :
// - api : le serveur a répondu en erreur, réessayer a du sens ;
// - reseau : aucune réponse, il faut d'abord retrouver une connexion ;
// - session : fin de validité, qui mène à la reconnexion ;
// - refus : refus métier, que l'appelant ne doit pas proposer de réessayer.

const MESSAGES = {
  api: {
    titre: 'Données indisponibles',
    explication: "Le serveur n'a pas pu répondre à la demande. Vous pouvez réessayer.",
  },
  reseau: {
    titre: 'Connexion indisponible',
    explication:
      "L'application n'a pas réussi à joindre le serveur. Vérifiez votre connexion, puis réessayez.",
  },
  session: {
    titre: 'Session expirée',
    explication: 'Votre session a pris fin. Reconnectez-vous pour retrouver vos données.',
  },
  refus: {
    titre: 'Opération refusée',
    explication: "Cette opération n'a pas pu être effectuée.",
  },
};

export default function MessageErreur({
  nature = 'api',
  message,
  libelleAction = 'Réessayer',
  surAction,
  className = '',
  ...proprietes
}) {
  const { titre, explication } = MESSAGES[nature] ?? MESSAGES.api;

  return (
    <div className={`message-erreur${className ? ` ${className}` : ''}`} role="alert" {...proprietes}>
      <span className="message-erreur__symbole" aria-hidden="true">
        ⚠
      </span>
      <div className="message-erreur__texte">
        <p className="message-erreur__titre">{titre}</p>
        {/* Le message du serveur, plus précis, remplace l'explication générique. */}
        <p className="message-erreur__explication">{message || explication}</p>
      </div>
      {surAction && (
        <Bouton type="button" variante="secondaire" onClick={surAction}>
          {libelleAction}
        </Bouton>
      )}
    </div>
  );
}
