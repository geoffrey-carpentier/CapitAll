import './BasculeDevise.css';

// Bascule de la devise d'affichage.
//
// Elle ne déclenche aucune requête : le taux accompagne déjà la réponse du portefeuille,
// et c'est l'interface qui l'applique. Rien n'est recalculé ni stocké dans une seconde
// devise, les montants restent en euros de bout en bout, l'euro étant la devise de
// référence des calculs.
//
// Deux boutons plutôt qu'un interrupteur : l'état courant est alors lisible sans avoir
// à deviner ce que la bascule ferait si on l'actionnait. Ils forment un groupe de
// boutons radio, ce qui donne la navigation aux flèches sans code supplémentaire.

const DEVISES = [
  { code: 'EUR', libelle: '€', description: 'Afficher les montants en euros' },
  { code: 'USD', libelle: '$', description: 'Afficher les montants en dollars' },
];

export default function BasculeDevise({ devise = 'EUR', surChangement, indisponible = false }) {
  return (
    <div
      className="bascule-devise"
      role="radiogroup"
      aria-label="Devise d'affichage"
      {...(indisponible ? { 'aria-describedby': 'bascule-devise-indisponible' } : {})}
    >
      {DEVISES.map(({ code, libelle, description }) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={devise === code}
          aria-label={description}
          // Le taux vient du serveur : sans lui, la conversion serait une invention.
          // Le bouton euro reste actif, c'est la devise de référence.
          disabled={indisponible && code !== 'EUR'}
          className={`bascule-devise__choix${devise === code ? ' bascule-devise__choix--actif' : ''}`}
          onClick={() => surChangement?.(code)}
        >
          {libelle}
        </button>
      ))}
      {indisponible && (
        <span id="bascule-devise-indisponible" className="lecteur-ecran-seulement">
          Taux de change indisponible, affichage en euros uniquement.
        </span>
      )}
    </div>
  );
}
