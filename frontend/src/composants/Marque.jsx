import './Marque.css';

// Marque de l'application : un portefeuille traversé par une courbe montante.
//
// Le dégradé reprend deux couleurs de classe existantes, sans ajouter de teinte. Le
// dessin est décoratif (aria-hidden) : le nom du produit est écrit à côté.
export default function Marque({ taille = 32 }) {
  return (
    <svg
      className="marque"
      width={taille}
      height={taille}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="marque-fond" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--couleur-classe-crypto)" />
          <stop offset="100%" stopColor="var(--couleur-classe-action)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#marque-fond)" />

      <rect x="7" y="23" width="18" height="2.5" rx="1.25" className="marque__fente" />

      {/* La courbe et son dernier relevé. */}
      <path
        className="marque__trace"
        d="M7 18.5 L12.5 13 L17 16 L25 7"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="marque__releve" cx="25" cy="7" r="2.6" />
    </svg>
  );
}
