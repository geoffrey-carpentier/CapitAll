# 0009 — Fournisseurs de cours et liste blanche des actions

- **Date** : 16 et 21 juillet 2026, catalogue élargi le 6 septembre 2026
- **Statut** : acceptée

## Contexte

Quatre classes d'actifs demandent quatre sources : aucun fournisseur gratuit ne couvre correctement les cryptomonnaies, les devises, les métaux et les actions à la fois. Les offres gratuites imposent par ailleurs des quotas serrés, et leur couverture varie : un symbole servi par l'un est absent chez l'autre.

## Décision

Un adaptateur par classe, derrière une interface commune, de sorte qu'un changement de fournisseur ne touche qu'un fichier :

| Classe | Source | Devise rendue |
|---|---|---|
| cryptomonnaies | Coinbase | euro directement |
| devises | Frankfurter, taux de référence | taux inversé vers l'euro |
| métaux précieux | gold-api | dollar, converti en euros |
| actions | chaîne de trois fournisseurs | dollar, converti en euros |

Pour les actions, les fournisseurs sont chaînés : le premier répond, les suivants prennent le relais en cas d'échec ou d'absence du symbole. Le taux de change est demandé **une seule fois**, hors de la boucle des fournisseurs, pour qu'une panne de change ne soit pas imputée aux cotateurs.

Les actions sont limitées à une **liste blanche** codée côté serveur, et non ouvertes à une recherche libre. Les cryptomonnaies et les devises restent ouvertes, le catalogue ne servant alors que de suggestion.

## Conséquences

- La liste blanche borne le sujet et rend le comportement prévisible ; elle demande en contrepartie un entretien : un titre retiré de la cote garde un cours figé et doit sortir de la liste.
- Les clés d'API des fournisseurs d'actions sont facultatives : sans elles, les autres classes fonctionnent et les actions restent non valorisées.
- Ces clés sont actuellement transmises en paramètre d'URL, ce qu'imposent les fournisseurs retenus. Elles peuvent donc apparaître dans des journaux intermédiaires : à réexaminer lors du choix d'un hébergement réel.
- Aucune donnée historique n'est récupérée auprès de ces fournisseurs : un actif nouvellement suivi n'a pas de courbe tant que l'application n'a pas relevé ses cours elle-même (voir `0010`).
