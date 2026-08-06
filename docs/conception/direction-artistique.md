# Direction artistique - CapitAll

Direction retenue : interface sombre, sobre, inspirée des applications de suivi financier. Validée le 13/07/2026.

## Palette

| Usage | Couleur | Code |
|---|---|---|
| Fond principal | gris très sombre | #101418 |
| Fond des cartes | gris sombre | #1A2027 |
| Bordures / séparateurs | gris moyen | #2D3640 |
| Texte principal | blanc cassé | #E8ECF1 |
| Texte secondaire | gris clair | #9AA7B4 |
| Accent (actions, liens) | bleu | #4C9AFF |
| Plus-value positive | vert | #34C77B |
| Plus-value négative | rouge | #F0564F |

Contrastes vérifiés à respecter (RGAA) : texte principal et secondaire sur fond carte au minimum 4,5:1 ; le vert et le rouge sont toujours accompagnés d'un signe (+/-) et d'une flèche, jamais seuls porteurs de l'information.

## Typographie

- Inter (Google Fonts), régulière pour le texte, semi-bold pour les montants et titres
- montants en tabular-nums pour l'alignement vertical des chiffres

## Principes de mise en page

- mobile-first : une colonne, cartes empilées ; sur desktop, grille deux colonnes pour le tableau de bord
- navigation par barre d'onglets en bas sur mobile à cinq entrées (patrimoine, positions, ajout au centre, seuils, compte), rail latéral sur desktop
- coins arrondis discrets (8 px), pas d'ombres marquées, hiérarchie par la couleur de fond
- graphique de répartition en anneau, courbe d'évolution en aire dégradée

## Grammaire visuelle

Trois niveaux de contenant et pas davantage : à plat sur le fond pour les listes et les formulaires, carte bordée pour les blocs à frontière logique, carte au fond accentué pour le seul bloc de patrimoine.

Rythme vertical à trois valeurs : 32 px avant un changement de section, 24 px entre blocs d'une même section, 12 px entre éléments liés. L'espace au-dessus d'un titre est toujours supérieur à l'espace en dessous.

Chaque classe d'actif porte un jeton distinct **par la forme** et pas seulement par la couleur : cercle pour les cryptomonnaies, carré arrondi pour les métaux, losange pour les devises, hexagone pour les actions. La forme reste lisible en niveaux de gris.

Sur tout graphe de cours d'une position, le prix de revient est tracé en ligne horizontale pointillée, l'aire entre la courbe et cette ligne étant teintée selon le signe. C'est le geste graphique propre à l'application : il donne à voir d'un regard l'information principale du produit.

## Écrans à maquetter (Figma)

1. connexion / inscription
2. patrimoine (tableau de bord)
3. positions
4. détail d'une position
5. mouvement (achat ou vente)
6. seuils
7. compte

Chaque écran en version mobile (375 px) et desktop (1440 px), accompagné d'une planche d'états couvrant le premier lancement, le portefeuille vide, le chargement, l'erreur d'API, l'erreur réseau, la session expirée et le repli sur le dernier cours connu.

Direction retenue : une seule interface à deux points de rupture, dense et outillée en desktop, resserrée sur le geste en mobile. Les prototypes HTML ayant servi aux arbitrages ne sont pas versionnés.

## Documents liés

Le détail de chaque écran, ses états et ses règles d'interaction : `specification-fonctionnelle.md`. Le formatage de toute valeur numérique affichée : `formatage-nombres.md`.
