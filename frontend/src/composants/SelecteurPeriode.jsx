import { useRef } from 'react';
import './SelecteurPeriode.css';
import Variation from './Variation';

// Sélecteur de période de la courbe d'évolution.
//
// Chaque plage affiche sa propre performance sans qu'on ait à cliquer : cinq
// informations pour un regard, là où un sélecteur ordinaire en donnerait une seule et
// obligerait à parcourir les cinq onglets pour comparer.
//
// Véritable groupe d'onglets au sens ARIA, et non une rangée de boutons. Conséquence
// concrète : une seule tabulation entre dans le groupe, les flèches circulent d'un
// onglet à l'autre, et le contenu associé est désigné. C'est le motif attendu par les
// lecteurs d'écran pour ce type de commande.
//
// Le masquage des montants ne s'applique pas ici : une performance est une part
// relative, elle ne dit rien de ce que l'utilisateur possède.

const PLAGES = [
  { code: 'jour', libelle: 'Jour', description: 'Depuis hier' },
  { code: 'semaine', libelle: 'Semaine', description: 'Sur sept jours' },
  { code: 'mois', libelle: 'Mois', description: 'Sur trente jours' },
  { code: 'annee', libelle: 'Année', description: 'Sur un an' },
  { code: 'origine', libelle: 'Origine', description: 'Depuis le début du suivi' },
];

export default function SelecteurPeriode({
  periode = 'mois',
  performances = {},
  surChangement,
  identifiantPanneau,
}) {
  const references = useRef([]);

  // Navigation aux flèches, avec bouclage : depuis le dernier onglet, la flèche droite
  // revient au premier. Le déplacement sélectionne la plage, ce qui correspond au
  // comportement attendu d'un groupe d'onglets à activation automatique.
  function auClavier(evenement, index) {
    const deplacements = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: PLAGES.length - 1 - index };
    const deplacement = deplacements[evenement.key];

    if (deplacement === undefined) {
      return;
    }

    evenement.preventDefault();
    const cible = (index + deplacement + PLAGES.length) % PLAGES.length;
    references.current[cible]?.focus();
    surChangement?.(PLAGES[cible].code);
  }

  return (
    <div className="selecteur-periode" role="tablist" aria-label="Période de la courbe">
      {PLAGES.map(({ code, libelle, description }, index) => {
        const actif = code === periode;
        const performance = performances[code] ?? null;

        return (
          <button
            key={code}
            type="button"
            role="tab"
            id={`onglet-periode-${code}`}
            aria-selected={actif}
            aria-controls={identifiantPanneau}
            // Un seul onglet est atteignable à la tabulation : c'est ce qui distingue
            // un groupe d'onglets d'une rangée de boutons.
            tabIndex={actif ? 0 : -1}
            ref={(noeud) => {
              references.current[index] = noeud;
            }}
            className={`selecteur-periode__onglet${actif ? ' selecteur-periode__onglet--actif' : ''}`}
            onClick={() => surChangement?.(code)}
            onKeyDown={(evenement) => auClavier(evenement, index)}
          >
            <span className="selecteur-periode__libelle">{libelle}</span>
            <span className="lecteur-ecran-seulement">{description}</span>
            {/* Une plage sans assez de points n'affiche pas zéro, qui se lirait comme
                une stagnation constatée, mais un tiret. */}
            {performance === null ? (
              <span className="selecteur-periode__absente" aria-hidden="true">
                —
              </span>
            ) : (
              <Variation valeur={performance} />
            )}
          </button>
        );
      })}
    </div>
  );
}
