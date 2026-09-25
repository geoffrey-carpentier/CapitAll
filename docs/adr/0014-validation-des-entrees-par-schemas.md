# 0014 — Validation des entrées par schémas côté serveur

- **Date** : 27 juillet 2026
- **Statut** : acceptée

## Contexte

Les contrôles écrits à la main dans les contrôleurs se dispersent, se dupliquent et finissent par diverger d'une route à l'autre. Sur une application financière, un contrôle manquant ne produit pas une erreur visible : il produit un chiffre faux.

## Décision

Zod, en couche dédiée `backend/src/validation/`, appelée avant tout traitement. Chaque route a son schéma. Les entrées sont refusées en `400`, avec des erreurs rattachées au champ concerné pour que l'interface puisse les afficher au bon endroit.

Deux points particuliers :

- les montants et quantités sont acceptés en chaîne ou en nombre, mais convertis en **chaîne**, jamais en nombre JavaScript, conformément à `0003` ;
- une valeur dont la précision excède l'échelle prévue est **refusée**, pas arrondie silencieusement : la validation décide, pas le moteur de calcul.

La validation côté interface existe pour le confort de saisie. Elle ne remplace jamais celle du serveur, qui est la seule à faire foi.

## Conséquences

- Le contrat d'entrée de chaque route est lisible en un endroit, et testable sans HTTP.
- Les messages par défaut de la bibliothèque sont en anglais : ceux qui atteignent l'utilisateur doivent être écrits explicitement en français. Quelques messages n'ont pas encore été repris.
- Une évolution de schéma est un changement de contrat d'API, et relève à ce titre de la documentation de l'API.
