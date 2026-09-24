# 0018 — Outil de test et testabilité des services

- **Date** : 29 juillet 2026
- **Statut** : acceptée

## Contexte

La valeur de l'application tient à l'exactitude de ses calculs. Ces calculs devaient donc être vérifiables rapidement, souvent, et sans dépendre d'une base de données lancée ni d'un serveur HTTP démarré — faute de quoi les tests ne sont pas exécutés pendant l'écriture, et ne servent plus à rien.

## Décision

**Vitest** pour les deux moitiés du dépôt : un seul outil, une seule syntaxe, une seule configuration à connaître.

Trois niveaux, avec des rôles distincts :

- **unitaires** : la logique métier. Les services reçoivent leurs dépendances plutôt que de les chercher, ce qui permet de les tester sans base ni réseau. Les résultats attendus des règles de calcul sont posés à la main.
- **intégration** : ce qu'un test unitaire ne peut pas prouver — cloisonnement, transactions, verrous, contraintes de la base. Ils s'exécutent contre une vraie instance PostgreSQL, sur une pile dédiée et des ports séparés.
- **interface** : les composants sont testés sur ce que voit et fait l'utilisateur, pas sur leur état interne.

## Conséquences

- La suite unitaire s'exécute en quelques secondes, donc elle est réellement lancée.
- Les tests d'intégration demandent une base et ne s'exécutent pas dans les contrôles automatiques aujourd'hui : c'est un manque identifié, puisqu'ils couvrent précisément les invariants les plus coûteux à casser.
- Aucun seuil de couverture n'est imposé, conformément à `../qualite.md` : un test qui n'échouerait jamais ne protège rien.
