import { useEffect, useId, useRef } from 'react';
import './Confirmation.css';
import Bouton from './Bouton';

// Dialogue de confirmation d'une action destructrice. L'appelant fournit la conséquence
// concrète de l'action.
//
// Accessibilité :
// - le focus reste piégé dans le dialogue et revient au déclencheur à la fermeture ;
// - le bouton destructeur ne reçoit jamais le focus initial, pour qu'un Entrée réflexe
//   ne confirme rien ;
// - Échap annule.
//
// Une saisie éventuelle (mot de passe) est passée en enfant, hors du paragraphe de
// conséquence.
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

  // Identifiants uniques, pour qu'aria-labelledby ne désigne jamais le titre d'un autre
  // dialogue.
  const identifiantTitre = useId();
  const identifiantConsequence = useId();

  useEffect(() => {
    declencheur.current = document.activeElement;
    // Focus sur la saisie s'il y en a une, sinon sur Annuler : le bouton destructeur,
    // placé en dernier, ne le reçoit jamais.
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

    // Piège à focus : la tabulation boucle entre le premier et le dernier élément.
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
    // Pas de fermeture au clic sur le voile : un clic accidentel ne doit pas décider.
    <div className="confirmation__voile">
      <div
        className="confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby={identifiantTitre}
        aria-describedby={identifiantConsequence}
        ref={dialogue}
        onKeyDown={auClavier}
      >
        <h2 id={identifiantTitre} className="confirmation__titre">
          {titre}
        </h2>
        <p id={identifiantConsequence} className="confirmation__consequence">
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
