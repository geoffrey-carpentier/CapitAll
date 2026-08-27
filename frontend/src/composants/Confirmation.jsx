import { useEffect, useRef } from 'react';
import './Confirmation.css';
import Bouton from './Bouton';

// Dialogue de confirmation d'une action destructrice.
//
// Il ne demande pas « êtes-vous sûr », question à laquelle personne ne peut répondre
// utilement : il énonce ce qui va disparaître et ce que cela entraîne. C'est
// l'appelant qui fournit cette conséquence, parce que lui seul la connaît.
//
// Trois règles d'accessibilité, toutes exigées par la spécification et toutes vérifiées
// par les tests de l'écran.
//
// Le focus entre dans le dialogue à l'ouverture et n'en sort plus tant qu'il est
// ouvert : sans cela, la tabulation continuerait dans la page située derrière, qui est
// pourtant inerte. Il retourne à son point de départ à la fermeture, faute de quoi
// l'utilisateur se retrouverait projeté en haut du document.
//
// Le bouton destructeur n'est jamais celui qui reçoit le focus, ni le premier de
// l'ordre de tabulation. Une confirmation validée par une frappe d'Entrée réflexe
// n'aurait rien confirmé du tout.
//
// Échap annule. C'est le geste attendu de tout dialogue, et il doit rester la sortie la
// moins coûteuse.
// Certaines suppressions demandent une saisie avant d'être confirmées, la suppression
// du compte au premier chef. Ce contenu se place après la conséquence, hors du
// paragraphe qui la porte : un champ de formulaire n'a rien à faire dans un <p>.
export default function Confirmation({
  titre,
  consequence,
  children,
  libelleConfirmation = 'Supprimer',
  enCours = false,
  surConfirmation,
  surAnnulation,
}) {
  const dialogue = useRef(null);
  const declencheur = useRef(null);

  useEffect(() => {
    // L'élément actif au moment de l'ouverture est le bouton qui a demandé la
    // suppression : c'est là que le focus doit revenir.
    declencheur.current = document.activeElement;
    // Quand le dialogue porte une saisie, c'est elle qui reçoit le focus, l'utilisateur
    // ayant quelque chose à taper. Sinon, c'est le premier bouton, celui d'annulation.
    // Dans les deux cas le bouton destructeur, placé en dernier, ne le reçoit jamais.
    dialogue.current?.querySelector('input, button')?.focus();

    return () => {
      declencheur.current?.focus?.();
    };
  }, []);

  function auClavier(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      surAnnulation?.();
      return;
    }

    if (evenement.key !== 'Tab') {
      return;
    }

    // Piège à focus : la tabulation boucle entre le premier et le dernier élément
    // atteignable du dialogue.
    const atteignables = dialogue.current?.querySelectorAll(
      'input:not([disabled]), button:not([disabled])'
    );
    if (!atteignables || atteignables.length === 0) {
      return;
    }

    const premier = atteignables[0];
    const dernier = atteignables[atteignables.length - 1];

    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  }

  return (
    // Le voile n'est pas cliquable pour fermer : une fermeture par clic accidentel hors
    // du dialogue conviendrait à une feuille d'information, pas à la dernière barrière
    // avant une suppression.
    <div className="confirmation__voile">
      <div
        className="confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-confirmation"
        aria-describedby="consequence-confirmation"
        ref={dialogue}
        onKeyDown={auClavier}
      >
        <h2 id="titre-confirmation" className="confirmation__titre">
          {titre}
        </h2>
        <p id="consequence-confirmation" className="confirmation__consequence">
          {consequence}
        </p>
        {children}
        <div className="confirmation__actions">
          <Bouton variante="secondaire" onClick={surAnnulation} desactive={enCours}>
            Annuler
          </Bouton>
          <Bouton variante="danger" onClick={surConfirmation} enCours={enCours}>
            {libelleConfirmation}
          </Bouton>
        </div>
      </div>
    </div>
  );
}
