# 0003 — Arithmétique décimale exacte en entiers

- **Date** : juillet 2026, échelles révisées le 5 septembre 2026
- **Statut** : acceptée

## Contexte

Les nombres à virgule flottante de JavaScript ne représentent pas exactement les décimaux : `0.1 + 0.2` vaut `0.30000000000000004`. Sur un patrimoine, l'erreur ne reste pas théorique. Elle s'accumule à chaque opération, et un prix de revient est un quotient réinjecté dans tous les calculs suivants.

Les actifs suivis n'ont par ailleurs pas la même granularité : un jeton se divise en dix-huit décimales, un cours peut valoir moins d'un millionième d'euro, un montant en euros se règle au centime.

## Décision

Aucun montant, quantité, cours ni taux n'est calculé en virgule flottante. Chaque grandeur est portée par un entier `BigInt` exprimé dans une unité fixe, et chaque grandeur a son échelle propre :

| Grandeur | Décimales | Motif |
|---|---|---|
| quantités, frais en nature, prix, cours, taux | 18 | précision native des actifs suivis ; assez de chiffres significatifs pour un cours très faible |
| prix de revient unitaire | 24 | c'est un diviseur réinjecté dans chaque valorisation ; la marge évite qu'un arrondi ne remonte dans les montants |
| montants en euros | 2 | l'euro se règle au centime |

Règle d'arrondi unique dans tout le moteur : **au plus proche, les demis s'éloignant de zéro**, à la lecture comme au calcul. Une valeur trop précise pour l'échelle visée est arrondie, jamais tronquée. Les saisies hors échelle sont refusées par la validation, en `400`, plutôt que laissées au calcul.

Les opérations de multiplication et de division reçoivent explicitement l'échelle de chaque opérande et celle du résultat attendu : rien ne suppose une échelle commune.

## Conséquences

- Les montants circulent en **chaînes de caractères** dans les réponses de l'API : les convertir en nombres JavaScript perdrait la précision que tout le reste protège.
- Les colonnes correspondantes sont en `NUMERIC(38,18)` ou `NUMERIC(30,2)`, jamais en `REAL` ni `DOUBLE PRECISION`.
- L'interface n'effectue aucun calcul métier sur ces valeurs ; la seule arithmétique côté client est la conversion d'affichage, faite elle aussi en entiers.
- Le coût est un moteur décimal maison et des conversions explicites. Il est assumé : c'est la contrepartie d'un chiffre défendable.
