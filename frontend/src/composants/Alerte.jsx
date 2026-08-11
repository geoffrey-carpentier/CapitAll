import './Alerte.css';

// Bandeau de message. Le symbole placé devant le texte double l'information portée
// par la couleur : un daltonien, ou un écran en niveaux de gris, distingue toujours
// une erreur d'une information.
//
// role="alert" pour une erreur : le message est annoncé dès son apparition, sans
// attendre que l'utilisateur l'atteigne. Une simple information n'interrompt pas.
const SYMBOLES = {
  erreur: '⚠',
  information: 'ℹ',
};

export default function Alerte({ variante = 'information', children }) {
  return (
    <p
      className={`alerte alerte--${variante}`}
      role={variante === 'erreur' ? 'alert' : 'status'}
    >
      <span className="alerte__symbole" aria-hidden="true">
        {SYMBOLES[variante]}
      </span>
      <span>{children}</span>
    </p>
  );
}
