import './Squelette.css';

// Forme de chargement calquée sur le contenu attendu, jamais un rond tournant : la page
// garde sa composition, et le passage au contenu réel ne déplace rien.
//
// Le squelette n'apparaît pas avant 200 ms. Sur une connexion rapide, la réponse arrive
// avant ce délai et l'utilisateur ne voit aucun clignotement ; au-delà, l'attente
// devient visible. C'est le seuil retenu par la grammaire des états.
//
// aria-hidden : un squelette n'a rien à dire à un lecteur d'écran. C'est le conteneur
// de la zone en chargement qui porte l'annonce, une seule fois.
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
