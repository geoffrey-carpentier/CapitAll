import './BasculeDevise.css';

// Bascule de la devise d'affichage, sans requête : le taux est déjà dans la réponse du
// portefeuille, et les données restent en euros.
//
// Deux boutons radio plutôt qu'un interrupteur : l'état courant se lit directement.

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
          // Sans taux transmis par le serveur, seul l'euro reste disponible.
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
