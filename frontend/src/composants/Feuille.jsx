import { useEffect, useId, useRef } from 'react';
import './Feuille.css';

// Conteneur des saisies, superposé à l'écran d'origine qui reste visible derrière le
// voile : feuille glissante sous 720 px, dialogue centré au-dessus (seul le CSS change).
//
// Accessibilité : focus piégé, retour au déclencheur à la fermeture, Échap referme. Le
// focus initial va sur le dialogue lui-même, pour que son titre soit annoncé avant le
// premier champ.

const ATTEIGNABLES =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

export default function Feuille({
  titre,
  // Complément du titre (nom de l'actif), sur sa propre ligne.
  sousTitre,
  children,
  surFermeture,
  // Pendant un enregistrement, ni le bouton ni Échap ne ferment la feuille : sinon
  // l'utilisateur ne saurait pas ce qui a été écrit.
  verrouillee = false,
}) {
  const dialogue = useRef(null);
  const declencheur = useRef(null);
  const identifiant = useId();
  const idTitre = `${identifiant}-titre`;
  const idSousTitre = `${identifiant}-sous-titre`;

  useEffect(() => {
    declencheur.current = document.activeElement;
    dialogue.current?.focus();

    // Bloque le défilement de la page derrière la feuille.
    const defilementInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = defilementInitial;
      declencheur.current?.focus?.();
    };
  }, []);

  function auClavier(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      if (!verrouillee) {
        surFermeture?.();
      }
      return;
    }

    if (evenement.key !== 'Tab') {
      return;
    }

    const atteignables = dialogue.current?.querySelectorAll(ATTEIGNABLES);
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
    // Pas de fermeture au clic sur le voile : une saisie ne doit pas se perdre sur un
    // clic manqué.
    <div className="feuille__voile">
      <div
        className="feuille"
        role="dialog"
        aria-modal="true"
        // Le nom accessible reprend le titre et le sous-titre.
        aria-labelledby={sousTitre ? `${idTitre} ${idSousTitre}` : idTitre}
        tabIndex={-1}
        ref={dialogue}
        onKeyDown={auClavier}
      >
        <span className="feuille__poignee" aria-hidden="true" />

        <header className="feuille__entete">
          <div className="feuille__intitule">
            <h2 id={idTitre} className="feuille__titre">
              {titre}
            </h2>
            {sousTitre && (
              <p id={idSousTitre} className="feuille__sous-titre">
                {sousTitre}
              </p>
            )}
          </div>
          <button
            type="button"
            className="feuille__fermer"
            onClick={surFermeture}
            disabled={verrouillee}
            aria-label="Fermer"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="feuille__corps">{children}</div>
      </div>
    </div>
  );
}
