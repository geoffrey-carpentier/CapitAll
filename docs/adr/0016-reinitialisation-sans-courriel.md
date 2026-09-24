# 0016 — Réinitialisation de mot de passe sans service de courriel

- **Date** : 6 septembre 2026
- **Statut** : acceptée à titre provisoire

## Contexte

Le parcours « mot de passe oublié » suppose normalement l'envoi d'un lien par courriel. Le projet n'a pas de service d'envoi : ni serveur SMTP, ni fournisseur transactionnel, ni domaine configuré pour la délivrabilité. Sans substitut, le parcours existerait dans le code sans jamais pouvoir être parcouru.

## Décision

Le mécanisme reste complet côté serveur : une clé aléatoire de 32 octets, stockée **hachée**, valable une heure, à usage unique, consommée de façon atomique. La réponse à une demande de réinitialisation est **identique** que l'adresse existe ou non, et le nombre de demandes est plafonné.

Faute de canal d'envoi, la clé peut être **affichée à l'écran**, derrière une variable d'environnement fermée par défaut. Quand ce mode est actif, l'écran indique explicitement qu'il s'agit d'une commodité de démonstration.

Le coût est assumé et nommé : lorsqu'il est actif, ce mode révèle l'existence d'un compte, ce que la réponse neutre protégeait par ailleurs.

## Conséquences

- Le parcours est démontrable de bout en bout, sans dépendance externe.
- **Ce mode ne doit jamais être actif sur un service ouvert à des tiers.** C'est la raison du statut provisoire.
- Le jour où un canal d'envoi existera, l'affichage disparaît et le reste du mécanisme est inchangé : c'est un remplacement de transport, pas de logique.
- Une faiblesse subsiste dans l'enchaînement : la clé est consommée puis le mot de passe écrit hors d'une transaction commune ; un échec entre les deux brûle la clé sans changer le mot de passe.
