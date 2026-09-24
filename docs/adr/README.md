# Décisions d'architecture

Une décision par fichier, numérotée, datée, autonome : un lecteur doit pouvoir la comprendre sans autre contexte que le dépôt.

Ces fiches reprennent les choix structurants **encore en vigueur** au 24 septembre 2026. Elles ne racontent pas l'historique complet du projet : une décision abandonnée ou remplacée n'a de fiche que si la remplaçante s'appuie sur elle. La date indiquée est celle de la décision d'origine, pas celle de la rédaction de la fiche.

## Statuts

- **Acceptée** : en vigueur.
- **Acceptée à titre provisoire** : en vigueur, mais dépendante d'une contrainte qui doit disparaître ; la fiche dit laquelle.
- **À réexaminer** : en vigueur, mais une raison identifiée justifie de la reprendre.
- **Remplacée par NNNN** : conservée pour comprendre la suivante.

## Index

| N° | Titre | Statut |
|---|---|---|
| [0001](0001-monorepo-et-flux-de-branches.md) | Monorepo et flux de branches | Acceptée |
| [0002](0002-euro-devise-de-reference.md) | L'euro comme devise de référence, le dollar en affichage | Acceptée |
| [0003](0003-arithmetique-decimale-exacte.md) | Arithmétique décimale exacte en entiers | Acceptée |
| [0004](0004-regles-de-calcul-du-portefeuille.md) | Règles de calcul du portefeuille | Acceptée |
| [0005](0005-le-serveur-detient-le-calcul-metier.md) | Le serveur détient le calcul métier | Acceptée |
| [0006](0006-modele-relationnel-postgresql.md) | Modèle relationnel PostgreSQL, intégrité par contraintes | Acceptée |
| [0007](0007-migrations-versionnees-avec-registre.md) | Migrations versionnées avec registre d'empreintes | Acceptée |
| [0008](0008-cache-redis-des-cours.md) | Cache Redis des cours et durées de vie par classe | Acceptée |
| [0009](0009-fournisseurs-de-cours-et-liste-blanche.md) | Fournisseurs de cours et liste blanche des actions | Acceptée |
| [0010](0010-releves-de-valorisation.md) | Relevés de valorisation en écriture paresseuse | À réexaminer |
| [0011](0011-alertes-de-seuil.md) | Alertes de seuil évaluées à l'actualisation | Acceptée |
| [0012](0012-cloisonnement-404.md) | Cloisonnement des ressources : 404 plutôt que 403 | Acceptée |
| [0013](0013-serialisation-des-ecritures.md) | Sérialisation des écritures sur une position | Acceptée |
| [0014](0014-validation-des-entrees-par-schemas.md) | Validation des entrées par schémas côté serveur | Acceptée |
| [0015](0015-session-par-jeton.md) | Session par jeton : stockage, expiration, révocation | À réexaminer |
| [0016](0016-reinitialisation-sans-courriel.md) | Réinitialisation de mot de passe sans service de courriel | Acceptée à titre provisoire |
| [0017](0017-export-csv-des-mouvements.md) | Contrat de l'export CSV des mouvements | Acceptée |
| [0018](0018-tests-et-testabilite.md) | Outil de test et testabilité des services | Acceptée |
| [0019](0019-interface-sombre-mobile-first.md) | Interface sombre, mobile d'abord, jetons de style | Acceptée |
| [0020](0020-deploiement-par-conteneurs.md) | Déploiement par conteneurs, pile de démonstration | À réexaminer |

## Écrire une nouvelle décision

Copier la structure d'une fiche existante : contexte, décision, conséquences, statut. Une décision se justifie d'abord par ses effets techniques, jamais par la seule autorité de celui qui la prend. Une fiche remplacée n'est pas supprimée : son statut change, et elle renvoie vers celle qui la remplace.
