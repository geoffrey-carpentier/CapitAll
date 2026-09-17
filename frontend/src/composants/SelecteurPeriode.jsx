import { useRef } from 'react';
import './SelecteurPeriode.css';
import Variation from './Variation';

// Sélecteur de période de la courbe, chaque onglet affichant sa performance.
//
// Groupe d'onglets ARIA : une seule tabulation pour entrer, les flèches pour circuler.
// Les performances sont relatives et ne sont donc pas masquées.

const PLAGES = [
  { code: 'jour', libelle: 'Jour', description: 'Depuis hier' },
  { code: 'semaine', libelle: 'Semaine', description: 'Sur sept jours' },
  { code: 'mois', libelle: 'Mois', description: 'Sur trente jours' },
  { code: 'annee', libelle: 'Année', description: 'Sur un an' },
  // Depuis le premier relevé enregistré, pas depuis le premier achat.
  { code: 'origine', libelle: 'Suivi', description: 'Depuis le premier relevé' },
];

export default function SelecteurPeriode({
  periode = 'mois',
  performances = {},
  surChangement,
  identifiantPanneau,
}) {
  const references = useRef([]);

  // Flèches avec bouclage ; le déplacement sélectionne la plage (activation automatique).
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
            // Seul l'onglet actif est atteignable à la tabulation.
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
            {/* Sans assez de points : un tiret plutôt qu'un zéro trompeur. */}
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
