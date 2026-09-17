import './Squelette.css';

// Forme de chargement calquée sur le contenu attendu, pour que rien ne se déplace à
// l'arrivée des données. Elle n'apparaît qu'après 200 ms (voir Squelette.css).
//
// aria-hidden : c'est le conteneur de la zone en chargement qui porte l'annonce.
export default function Squelette({ forme = 'ligne', largeur, hauteur, ...proprietes }) {
  return (
    <span
      className={`squelette squelette--${forme}`}
      style={{ width: largeur, height: hauteur }}
      aria-hidden="true"
      {...proprietes}
    />
  );
}
