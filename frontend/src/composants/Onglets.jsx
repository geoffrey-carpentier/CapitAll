import { useRef } from 'react';
import './Onglets.css';

// Groupe d'onglets, au sens ARIA du terme.
//
// Le sélecteur de période suit déjà ce motif, mais avec ses propres plages et sa propre
// mise en forme : celui-ci est le cas général, une liste d'onglets nommés commandant un
// panneau. Les deux ne se fondent pas en un seul composant, l'un affichant une
// performance par onglet et l'autre un simple compteur.
//
// Conséquence concrète du motif : une seule tabulation entre dans le groupe, les flèches
// circulent d'un onglet à l'autre, et le panneau commandé est désigné. Une rangée de
// boutons obligerait à tabuler autant de fois qu'il y a d'onglets pour atteindre le
// contenu, ce que ce motif existe précisément pour éviter.
//
// Le panneau reste à la charge de l'appelant : c'est lui qui sait ce qu'il contient. Il
// lui suffit de porter role="tabpanel", l'identifiant transmis, et aria-labelledby
// pointant vers l'onglet sélectionné.
export default function Onglets({ onglets = [], actif, surChangement, identifiantPanneau, libelle }) {
  const references = useRef([]);

  // Activation automatique au déplacement : l'onglet reçu par la flèche est aussitôt
  // sélectionné. C'est le comportement attendu quand changer d'onglet ne coûte rien,
  // le contenu étant déjà chargé.
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
            {/* Le compteur est répété dans le libellé vocal : lu seul, un « 4 » collé
                au nom de l'onglet ne dirait pas de quoi il est le nombre. */}
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
