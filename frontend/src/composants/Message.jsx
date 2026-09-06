import './Message.css';

// Bandeau de message. Le terme « alerte » est réservé aux seuils de franchissement du
// portefeuille : l'employer ici aussi installerait une ambiguïté durable.
//
// Le symbole placé devant le texte double l'information portée
// par la couleur : un daltonien, ou un écran en niveaux de gris, distingue toujours
// une erreur d'une information.
//
// role="alert" pour une erreur : le message est annoncé dès son apparition, sans
// attendre que l'utilisateur l'atteigne. Une simple information n'interrompt pas.
//
// Trois variantes, et la distinction entre les deux premières compte. L'erreur signale
// que quelque chose a échoué ; l'avertissement signale une donnée incomplète ou
// dégradée, un cours absent ou repris du dernier connu, ce qui n'est ni une perte
// financière ni une panne. C'est la couleur d'avertissement que D70 réserve à ces
// états, et elle n'a pas d'autre emploi.
//
// Le demi-cercle de l'avertissement est le même signe que celui de la pastille de
// fraîcheur en état tiède : une donnée partielle porte partout la même marque.
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
