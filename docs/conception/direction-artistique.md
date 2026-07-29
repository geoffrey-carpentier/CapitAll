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
- navigation par barre d'onglets en bas sur mobile (tableau de bord, actifs, ajout, compte), barre latérale sur desktop
- coins arrondis discrets (8 px), pas d'ombres marquées, hiérarchie par la couleur de fond
- graphique de répartition en anneau, courbe d'évolution en aire dégradée

## Écrans à maquetter (Figma)

1. connexion / inscription
2. tableau de bord (valeur totale, plus-value globale, anneau de répartition, courbe d'évolution, sélecteur de devise d'affichage euro/dollar)
3. liste des actifs (carte par actif : symbole, quantité, PRU, cours, plus-value)
4. détail d'un actif (historique des transactions, plus-value latente)
5. formulaire d'ajout de transaction

Chaque écran en version mobile (375 px) et desktop (1440 px).
