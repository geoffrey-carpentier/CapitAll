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
const SYMBOLES = {
  erreur: '⚠',
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
