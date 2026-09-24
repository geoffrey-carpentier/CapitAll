# 0013 — Sérialisation des écritures sur une position

- **Date** : 31 août 2026
- **Statut** : acceptée

## Contexte

Un audit a montré qu'un invariant tenu pour acquis pouvait être enfreint. La règle est simple : à aucun instant de l'historique, le solde d'une position ne peut être négatif. Elle ne se vérifie pourtant pas sur le seul solde courant.

Deux chemins la mettaient en défaut. Une vente **antidatée**, insérée avant des mouvements existants, laisse le solde final correct tout en rendant négatif un solde intermédiaire. Et la **suppression** d'un achat antérieur peut rendre invalide une vente postérieure qui, elle, était légitime. Deux requêtes concurrentes pouvaient enfin valider chacune une vente que l'autre rendait impossible.

## Décision

Toute écriture sur une position — création, correction, suppression d'un mouvement — s'exécute **dans une transaction SQL**, après avoir pris un verrou sur la ligne de l'actif concerné. L'historique complet est ensuite rejoué dans l'ordre chronologique, et l'écriture est refusée si **un seul** préfixe de cet historique présente un solde négatif.

La vérification porte donc sur tous les instants, pas sur le résultat final.

## Conséquences

- Deux requêtes visant la même position s'exécutent l'une après l'autre. Le coût est négligeable à l'échelle d'un portefeuille personnel.
- Le refus doit rester compréhensible : un message qui ne dit pas quel mouvement postérieur devient impossible laisse l'utilisateur sans solution. Le message actuel est correct mais imprécis dans le cas rétroactif ; c'est une amélioration identifiée.
- La simulation d'un mouvement, qui n'écrit rien, n'a pas besoin du verrou.
- Cet invariant est couvert par des tests d'intégration contre une vraie base : il ne peut pas être vérifié par des tests unitaires seuls.
