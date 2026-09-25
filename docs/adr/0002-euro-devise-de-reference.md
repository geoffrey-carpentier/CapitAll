# 0002 — L'euro comme devise de référence, le dollar en affichage

- **Date** : 13 juillet 2026, complétée le 29 juillet 2026
- **Statut** : acceptée

## Contexte

Le portefeuille mélange des actifs cotés dans des devises différentes : les cryptomonnaies s'échangent en dollars comme en euros, les métaux précieux se cotent en dollars l'once, les actions américaines en dollars, les devises étrangères les unes contre les autres. Sans devise unique de calcul, la somme d'un portefeuille n'a pas de sens, et le prix de revient d'une position dépendrait de la devise dans laquelle on la regarde.

L'utilisateur visé est en zone euro. Il a cependant l'habitude de lire les cours des actions et des métaux en dollars.

## Décision

**L'euro est la devise de référence de tous les calculs et de tout le stockage.** Chaque cours récupéré auprès d'un fournisseur est converti en euros avant d'entrer dans le moteur : le prix de revient, les plus-values, les seuils d'alerte et les relevés de valorisation sont tous en euros.

Une bascule d'affichage euro / dollar existe dans l'interface. Elle est **strictement bornée à l'affichage** : elle applique un taux de change au montant déjà calculé en euros, et ne change ni les données stockées, ni le calcul, ni la saisie. Quand le taux est indisponible, l'affichage reste en euros.

## Conséquences

- Un taux de change indisponible dégrade l'affichage, jamais l'exactitude : les chiffres restent justes, dans leur devise de référence.
- La conversion d'affichage doit produire exactement le même résultat côté serveur et côté interface. Un jeu de cas partagé, `fixtures/conversion-affichage.json`, est lu par les deux suites de tests pour l'imposer.
- Une évolution vers d'autres devises de référence demanderait de reprendre le stockage, pas seulement l'affichage. Ce n'est pas prévu.
