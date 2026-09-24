# 0004 — Règles de calcul du portefeuille

- **Date** : 30 juillet 2026, étendue le 5 septembre 2026
- **Statut** : acceptée

## Contexte

Le prix de revient unitaire moyen pondéré et la plus-value admettent plusieurs conventions défendables : les frais peuvent être intégrés au coût ou traités à part, une vente peut ou non modifier le prix de revient, un rachat après une vente totale peut repartir de zéro ou conserver l'ancien coût. Chacune donne un chiffre différent pour les mêmes mouvements.

Ces règles devaient être arrêtées **avant** d'écrire le moteur, faute de quoi le comportement du code aurait tenu lieu de spécification.

## Décision

Sept règles, appliquées dans cet ordre :

1. Le prix de revient **intègre les frais d'achat** : il représente le coût de revient réel de la position.
2. Un achat recalcule le prix de revient en **moyenne pondérée**.
3. Une vente ne modifie **pas** le prix de revient, seulement la quantité détenue.
4. La plus-value réalisée d'une vente vaut `quantité × (prix de vente − prix de revient) − frais de vente`, cumulée sur l'actif.
5. Une vente totale suivie d'un rachat repart d'un **prix de revient neuf**.
6. Les transactions sont traitées par **ordre chronologique**, l'identifiant départageant celles de même date.
7. Une **sortie non marchande** — un transfert sortant, un don, une perte — retire de la quantité sans produit en euros. Le prix de revient unitaire n'en est pas modifié, et la valeur qui quitte la position est portée par un résultat distinct de la plus-value réalisée.

Les frais conservent par ailleurs leur unité d'origine : trois champs les décrivent, le montant réellement prélevé, son unité, et sa contre-valeur en euros au moment de l'opération, seule consommée par le moteur. La quantité enregistrée reste toujours la quantité réellement entrée ou sortie de la position.

## Conséquences

- Le prix de revient et la plus-value sont produits par **une seule traversée** de l'historique : deux implémentations parallèles finiraient par diverger sur un cas de bord, et c'est précisément ce chiffre qu'il faut pouvoir défendre.
- La règle 6 impose de rejouer l'historique complet dès qu'une transaction est ajoutée, corrigée ou supprimée, y compris rétroactivement.
- La règle 5 rend le calcul dépendant de l'ordre réel des mouvements et non de leur seul agrégat : le solde ne peut jamais devenir négatif à aucun instant de l'historique, ce que garantit `0013`.
- Ces règles sont vérifiées par un jeu d'essai dont les résultats attendus sont calculés à la main : `../jeu-essai-calculs.md`.
