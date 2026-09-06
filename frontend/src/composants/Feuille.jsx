import { useEffect, useId, useRef } from 'react';
import './Feuille.css';

// Conteneur des saisies : feuille glissante en mobile, dialogue centré en desktop.
//
// Jamais une page. La saisie se fait par-dessus l'écran d'origine, qui reste visible
// derrière le voile : c'est ce qui permet de vérifier une valeur pendant qu'on la
// saisit, et de retrouver son contexte à la fermeture.
//
// Le même composant sert les deux points de rupture. Seule la mise en forme change :
// ancrée en bas et pleine largeur sous 720 px, centrée et bornée en largeur au-dessus.
// Deux composants distincts auraient fait diverger deux comportements identiques.
//
// Accessibilité, mêmes règles que le dialogue de confirmation, dont celui-ci reprend la
// mécanique : le focus entre à l'ouverture, ne sort plus par la tabulation, revient à
// son point de départ à la fermeture, et Échap referme.
//
// Le focus entre sur le dialogue lui-même et non sur son premier champ : le titre et
// l'intention de la feuille sont ainsi énoncés avant que la saisie ne commence, et la
// tabulation suivante atteint le premier contrôle dans l'ordre du document.

// Tout ce qui peut recevoir le focus dans une feuille de saisie. Le dialogue de
// confirmation se contentait des boutons ; ici, les champs comptent aussi.
const ATTEIGNABLES =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

export default function Feuille({
  titre,
  children,
  surFermeture,
  // Pendant un enregistrement, la feuille ne se referme plus : ni par le bouton, ni
  // par Échap. Fermer une fenêtre dont la requête est partie laisserait l'utilisateur
  // sans réponse sur ce qui a été écrit.
  verrouillee = false,
}) {
  const dialogue = useRef(null);
  const declencheur = useRef(null);
  const identifiant = useId();
  const idTitre = `${identifiant}-titre`;

  useEffect(() => {
    declencheur.current = document.activeElement;
    dialogue.current?.focus();

    // Le fond ne défile plus tant que la feuille est ouverte : sur mobile, le
    // défilement se poursuivrait sous la feuille au lieu de la parcourir.
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
    // Le voile ne referme pas au clic : une saisie en cours ne doit pas disparaître sur
    // un clic manqué à côté de la feuille. La sortie explicite reste à un geste, par le
    // bouton de fermeture ou par Échap.
    <div className="feuille__voile">
      <div
        className="feuille"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
        ref={dialogue}
        onKeyDown={auClavier}
      >
        <span className="feuille__poignee" aria-hidden="true" />

        <header className="feuille__entete">
          <h2 id={idTitre} className="feuille__titre">
            {titre}
          </h2>
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
