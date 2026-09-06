# Jeu d'essai des calculs de portefeuille

Ce document déroule, sur un scénario volontairement simple, la façon dont CapitAll calcule le prix de revient unitaire moyen pondéré (PRU), la plus-value réalisée et la plus-value latente. Les nombres ont été choisis pour être vérifiables de tête.

Le scénario est repris à l'identique dans les tests automatisés (`backend/src/services/__tests__/calculPortefeuille.test.js`) : le document et le code disent la même chose.

## Les six règles appliquées

| # | Règle | Pourquoi |
|---|---|---|
| 1 | Le PRU intègre les frais d'achat | Le coût de revient réel comprend ce qu'il a fallu payer pour acquérir le titre. Exclure les frais reviendrait à sous-estimer le prix payé et à afficher une plus-value flatteuse. |
| 2 | Un achat recalcule le PRU en moyenne pondérée | C'est la convention de l'administration fiscale française et des courtiers. Elle donne un prix de revient unique par ligne, indépendant de l'ordre des ventes. |
| 3 | Une vente ne modifie pas le PRU | Vendre ne change pas ce qu'ont coûté les titres restants. Seule la quantité détenue diminue. |
| 4 | La plus-value réalisée vaut `quantité × (prix de vente − PRU) − frais de vente` | C'est le gain effectivement encaissé sur les titres cédés, net des frais de la vente. |
| 5 | Une vente totale suivie d'un rachat repart d'un PRU neuf | La position précédente est soldée : le nouveau lot n'a aucun lien de coût avec l'ancien. |
| 6 | Les transactions sont traitées par ordre chronologique | Saisir après coup une transaction ancienne doit donner le même résultat que l'avoir saisie dans l'ordre. Sans ce tri, le calcul dépendrait de l'ordre de frappe. |

Ces règles sont figées ; le moteur de calcul les applique sans variante.

## Scénario

Un utilisateur suit un actif fictif. Il réalise trois opérations, puis consulte son portefeuille alors que le cours vaut 130,00 euros.

| Date | Opération | Quantité | Prix unitaire | Frais |
|---|---|---|---|---|
| 10/01/2026 | Achat | 10 | 100,00 € | 5,00 € |
| 10/02/2026 | Achat | 10 | 120,00 € | 5,00 € |
| 10/03/2026 | Vente | 5 | 150,00 € | 5,00 € |

## Déroulé, ligne par ligne

| Après l'opération | Quantité détenue | PRU | Coût total | Plus-value réalisée cumulée |
|---|---|---|---|---|
| Achat du 10/01 | 10 | 100,50 € | 1 005,00 € | 0,00 € |
| Achat du 10/02 | 20 | 110,50 € | 2 210,00 € | 0,00 € |
| Vente du 10/03 | 15 | 110,50 € | 1 657,50 € | 192,50 € |

## Le calcul du PRU après le second achat, en toutes lettres

C'est la ligne la plus instructive du scénario, celle où la moyenne pondérée entre en jeu.

Avant cette opération, l'utilisateur détient **10 titres** dont le prix de revient unitaire est de **100,50 €**. Ce PRU vient du premier achat : 10 titres à 100,00 € coûtent 1 000,00 €, auxquels s'ajoutent 5,00 € de frais, soit **1 005,00 € pour 10 titres**, donc 100,50 € l'unité (règle 1).

Le second achat porte sur **10 titres à 120,00 €**, soit 1 200,00 €, plus 5,00 € de frais : **1 205,00 €**.

Le nouveau PRU est le coût total divisé par la quantité totale (règle 2) :

```
PRU = (100,50 × 10 + 120,00 × 10 + 5,00) / (10 + 10)
    = (1 005,00 + 1 205,00) / 20
    = 2 210,00 / 20
    = 110,50 €
```

L'utilisateur détient désormais **20 titres à 110,50 € de prix de revient**, pour un coût total de **2 210,00 €**.

On notera que le PRU obtenu n'est pas la moyenne arithmétique des deux prix d'achat (110,00 €) : les frais des deux opérations, 10,00 € au total, ajoutent 0,50 € par titre.

## La vente et la plus-value réalisée

La vente du 10/03 porte sur 5 titres à 150,00 €, avec 5,00 € de frais. Le PRU reste à 110,50 € (règle 3), seule la quantité détenue passe de 20 à 15.

La plus-value réalisée se calcule sur les seuls titres cédés (règle 4) :

```
Plus-value réalisée = 5 × (150,00 − 110,50) − 5,00
                    = 5 × 39,50 − 5,00
                    = 197,50 − 5,00
                    = 192,50 €
```

Ce gain est acquis : il ne dépend plus d'aucun cours futur.

## Valorisation finale

Le cours de l'actif vaut **130,00 €** au moment de la consultation. L'utilisateur détient 15 titres à 110,50 € de prix de revient.

```
Valeur de la position   = 15 × 130,00 = 1 950,00 €
Plus-value latente      = 15 × (130,00 − 110,50) = 15 × 19,50 = 292,50 €
Variation               = 292,50 / 1 657,50 = 17,65 %
```

La plus-value latente est **potentielle** : elle varie à chaque mouvement de cours et ne devient acquise qu'à la vente. C'est la raison pour laquelle les deux plus-values sont présentées séparément et jamais additionnées en un chiffre unique.

## Récapitulatif de la position

| Grandeur | Valeur |
|---|---|
| Quantité détenue | 15 |
| Prix de revient unitaire | 110,50 € |
| Coût total de la position | 1 657,50 € |
| Valeur au cours de 130,00 € | 1 950,00 € |
| Plus-value latente | 292,50 € (+17,65 %) |
| Plus-value réalisée | 192,50 € |

## Exactitude des calculs

Aucun montant n'est calculé en virgule flottante. Les quantités et les montants sont convertis en entiers exprimés dans une unité fixe (huit décimales pour les quantités et le PRU, deux pour les montants), puis manipulés en arithmétique entière exacte.

Ce choix n'est pas théorique : en virgule flottante, `0,1 + 0,2` vaut `0,30000000000000004`. Sur un portefeuille de cryptomonnaies, où les quantités comportent couramment huit décimales, l'écart se propage à chaque opération. Un test dédié vérifie que l'addition de 0,1 et 0,2 rend exactement 0,3.

Le PRU est conservé à huit décimales et non à deux : arrondi au centime, le prix de revient d'un actif coté très haut ou très bas serait faussé, et l'erreur se reporterait sur la plus-value.

## Ce qui est stocké et ce qui ne l'est pas

Le PRU et les plus-values ne sont **jamais enregistrés en base**. Ils sont recalculés depuis les transactions à chaque consultation : une valeur stockée pourrait diverger de l'historique dont elle est censée découler, par exemple après la correction d'une transaction saisie par erreur.

La seule valeur dérivée conservée est le **snapshot de valorisation journalier**, et pour une raison précise : la valeur du portefeuille à une date passée n'est plus reconstituable une fois la journée écoulée, faute de conserver les cours historiques de chaque fournisseur. Un snapshot est donc un fait daté, pas une redondance.
