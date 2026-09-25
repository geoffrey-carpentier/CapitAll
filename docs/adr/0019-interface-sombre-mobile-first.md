# 0019 — Interface sombre, mobile d'abord, jetons de style

- **Date** : 13 juillet 2026, précisée d'août à septembre 2026
- **Statut** : acceptée

## Contexte

L'usage visé est bref et répété : on ouvre l'application pour regarder où en est son patrimoine, souvent depuis un téléphone. L'écran doit donner l'essentiel en un coup d'œil, sans fatiguer la lecture de chiffres denses.

Le risque d'un thème sombre est connu : contrastes insuffisants, et couleurs sémantiques — le vert du gain, le rouge de la perte — qui deviennent la seule porteuse d'information.

## Décision

Une interface **sombre**, conçue **d'abord pour le mobile**, l'affichage sur grand écran venant ensuite.

Le style passe exclusivement par des **jetons** déclarés en variables CSS : fond, cartes, texte, accent, couleurs sémantiques, bordures, contours de contrôle. Aucune valeur de couleur n'est écrite en dur dans un composant, à deux exceptions documentées.

Trois règles d'accessibilité encadrent le thème :

- contraste vérifié et documenté pour chaque couple de jetons réellement employé ;
- l'information portée par une couleur l'est toujours aussi par le texte ou la forme — un signe, un libellé, une icône ;
- toute zone interactive mesure au moins 44 x 44 px en mobile, la règle portant sur la zone effective et non sur la taille visuelle du contrôle.

Les quatre classes d'actifs ont leurs couleurs propres, réservées à l'anneau de répartition et à sa légende. Elles ne sont jamais des couleurs sémantiques : aucune ne signifie un gain ni une perte.

## Conséquences

- Un thème clair est possible sans toucher aux composants, en redéfinissant les jetons ; il n'existe pas aujourd'hui.
- Toute couleur nouvelle passe par un jeton et par une vérification de contraste : c'est volontairement contraignant.
- Les repères visuels sont documentés dans `../conception/direction-artistique.md`, qui fait foi pour les valeurs.
