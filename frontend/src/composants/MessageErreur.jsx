import './MessageErreur.css';
import Bouton from './Bouton';

// Erreur présentée à l'utilisateur : une cause en clair, et l'action qui permet de s'en
// sortir. Jamais un code technique brut, qui n'apprend rien à celui qui le lit et
// inquiète sans l'aider.
//
// Trois natures d'erreur, volontairement distinguées. Le serveur qui répond en erreur
// et le réseau qui ne répond pas ne demandent pas le même geste : dans un cas réessayer
// a du sens, dans l'autre il faut d'abord retrouver une connexion. Les confondre sous
// « une erreur est survenue » laisserait l'utilisateur sans prise.
//
// La session expirée n'est pas une panne mais une fin de validité : elle se dit
// autrement et mène à la reconnexion.

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
        {/* Le message du serveur, quand il est rédigé pour un humain, est plus précis
            que l'explication générique : il la remplace. */}
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
