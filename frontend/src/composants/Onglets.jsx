import { useRef } from 'react';
import './Onglets.css';

// Groupe d'onglets ARIA avec compteur : une seule tabulation pour entrer, les flèches
// pour circuler.
//
// L'appelant fournit le panneau : role="tabpanel", l'identifiant transmis et
// aria-labelledby vers l'onglet sélectionné.
export default function Onglets({ onglets = [], actif, surChangement, identifiantPanneau, libelle }) {
  const references = useRef([]);

  // Activation automatique : le contenu étant déjà chargé, changer d'onglet ne coûte rien.
  function auClavier(evenement, index) {
    const deplacements = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -index,
      End: onglets.length - 1 - index,
    };
    const deplacement = deplacements[evenement.key];

    if (deplacement === undefined) {
      return;
    }

    evenement.preventDefault();
    const cible = (index + deplacement + onglets.length) % onglets.length;
    references.current[cible]?.focus();
    surChangement?.(onglets[cible].code);
  }

  return (
    <div className="onglets" role="tablist" aria-label={libelle}>
      {onglets.map(({ code, libelle: intitule, compteur }, index) => {
        const selectionne = code === actif;

        return (
          <button
            key={code}
            type="button"
            role="tab"
            id={`onglet-${code}`}
            aria-selected={selectionne}
            aria-controls={identifiantPanneau}
            tabIndex={selectionne ? 0 : -1}
            ref={(noeud) => {
              references.current[index] = noeud;
            }}
            className={`onglets__onglet${selectionne ? ' onglets__onglet--actif' : ''}`}
            onClick={() => surChangement?.(code)}
            onKeyDown={(evenement) => auClavier(evenement, index)}
          >
            {intitule}
            {/* Compteur explicité pour les lecteurs d'écran. */}
            {compteur !== undefined && (
              <>
                <span className="onglets__compteur" aria-hidden="true">
                  {compteur}
                </span>
                <span className="lecteur-ecran-seulement">, {compteur}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
