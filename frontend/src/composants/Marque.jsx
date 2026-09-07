import './Marque.css';

// Marque de l'application.
//
// Elle remplace la lettre W posée sur un carré d'accent, qui était un pis-aller : une
// initiale dans une pastille ne dit rien du produit et se confond avec les dizaines
// d'applications qui font la même chose.
//
// Le dessin réunit les deux moitiés du nom. Le corps arrondi et la fente horizontale
// basse sont ceux d'un portefeuille ; la ligne qui le traverse en montant, avec son point
// de relevé au sommet, est la courbe que l'application passe son temps à tracer. C'est
// exactement ce que fait le produit : un portefeuille qu'on surveille.
//
// Le dégradé va du bleu des cryptomonnaies au rose des actions, deux des quatre couleurs
// de classe arbitrées en D98. Aucune teinte nouvelle n'entre donc dans la palette, et la
// marque emprunte au système au lieu de vivre à côté.
//
// Le tracé est décoratif : le nom du produit est écrit à côté, en toutes lettres. La
// marque porte donc aria-hidden, et rien de ce qu'elle montre n'est perdu sans elle.
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

      {/* Le corps du portefeuille. */}
      <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#marque-fond)" />

      {/* La fente, en bas : ce qui fait lire un portefeuille plutôt qu'une pastille. */}
      <rect x="7" y="23" width="18" height="2.5" rx="1.25" className="marque__fente" />

      {/* La courbe suivie, et son dernier relevé. Elle monte vers la droite et sort du
          cadre optique du corps, ce qui donne au signe son mouvement. */}
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
