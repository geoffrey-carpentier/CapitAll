# 0001 — Monorepo et flux de branches

- **Date** : 13 juillet 2026, complétée le 24 juillet et le 29 juillet 2026, révisée le 24 septembre 2026
- **Statut** : acceptée

## Contexte

L'application comporte une interface React et une API Node. Les deux évoluent souvent dans le même mouvement : un champ ajouté au modèle traverse la base, l'API et l'écran. Deux dépôts séparés auraient obligé à coordonner deux historiques pour une seule fonctionnalité, et rendu illisible la question « quel état de l'interface fonctionne avec quel état de l'API ».

Le projet a par ailleurs un seul mainteneur, ce qui rend la discipline de branche d'autant plus nécessaire : rien ne signale une erreur à sa place.

## Décision

Un dépôt unique, avec `frontend/` et `backend/` à la racine, et une pile de conteneurs commune.

Trois niveaux de branches :

- `main` reçoit les versions. Elle est protégée : pull request obligatoire, contrôles automatiques bloquants, poussée forcée et suppression interdites.
- `dev` reçoit le travail validé. Les contrôles automatiques y sont exigés.
- une branche par **lot cohérent**, créée depuis `dev`, nommée `<type>/<numéro d'issue>-<slug>`, où le type est celui des messages de commit : `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `build`, `perf`.

Un lot regroupe des travaux qui n'ont pas d'intérêt à être livrés séparément. À l'intérieur du lot, chaque issue garde son commit : la fréquence des branches diminue, pas la granularité de l'historique.

La révision du 24 septembre 2026 porte sur un seul point : les types de branche autorisés étaient limités à `feature/` et `fix/`, alors que le travail réel produit aussi de la documentation, de l'entretien et des remaniements. La règle suit désormais les types de commit, déjà connus.

## Conséquences

- Une pull request traverse les deux moitiés de l'application, ce qui rend la relecture plus large mais la cohérence vérifiable.
- Les contrôles automatiques s'exécutent sur l'ensemble, même quand une seule moitié change : c'est plus lent, et cela évite les régressions croisées.
- Le propriétaire du dépôt peut contourner la protection de `main` en cas d'urgence. Le contournement est tracé par GitHub et doit rester exceptionnel.
- Les branches ne sont pas supprimées automatiquement à la fusion : l'historique des lots reste consultable.

## Voir aussi

`../convention-commits.md` pour le format exact des messages, `../contribuer.md` pour le cycle complet.
