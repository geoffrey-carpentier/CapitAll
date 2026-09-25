# 0005 — Le serveur détient le calcul métier

- **Date** : 11 août 2026
- **Statut** : acceptée

## Contexte

Au moment d'écrire les écrans, la même question revenait pour chaque valeur affichée : la calculer côté serveur et la transmettre, ou transmettre les données brutes et laisser l'interface faire l'opération. La seconde voie est tentante, elle évite un aller-retour et semble plus réactive.

Elle conduit pourtant à deux implémentations d'une même règle, dans deux langages, avec deux arithmétiques — dont l'une, côté navigateur, ne dispose pas du moteur décimal exact du serveur.

## Décision

**Toute donnée représentant un état métier est calculée côté serveur** : prix de revient, plus-values, valorisations, variations, répartitions, pourcentages, franchissements de seuil.

L'interface fait trois choses, et pas une de plus : elle présente une valeur reçue, elle la met en forme, et elle applique la conversion d'affichage euro / dollar décrite en `0002`.

Le corollaire tient en une règle pratique : si une valeur a besoin d'une règle de gestion pour être obtenue, elle vient du serveur. Si elle a seulement besoin d'un format, elle est produite à l'affichage.

## Conséquences

- L'effet d'un mouvement encore non enregistré doit lui aussi venir du serveur : une route de simulation rend le nouveau prix de revient et la plus-value induite avant l'enregistrement, pour que l'écran de saisie montre un chiffre exact plutôt qu'une estimation.
- Le nombre d'appels augmente, et certaines interactions dépendent du réseau. C'est le prix d'un chiffre unique et défendable.
- Les composants d'interface restent simples à tester : ils affichent ce qu'on leur donne.
- Une règle de calcul ne se corrige qu'à un seul endroit.
