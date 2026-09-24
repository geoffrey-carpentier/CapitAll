# Exigences de qualité

Ce que le projet tient pour non négociable, et le niveau de preuve attendu selon le risque. Le déroulé d'une contribution est dans `contribuer.md` ; les choix qui fondent ces exigences sont dans `adr/`.

## 1. Exactitude des montants

C'est l'exigence première : une application de suivi de patrimoine qui affiche un chiffre faux ne sert à rien.

- Aucun montant, quantité, cours ou taux n'est calculé en virgule flottante, d'un bout à l'autre de la chaîne (voir `adr/0003-arithmetique-decimale-exacte.md`).
- Les montants circulent en chaînes de caractères dans les réponses de l'API, et sont stockés en `NUMERIC`.
- Toute valeur dérivée d'un montant est calculée par le serveur, jamais reconstituée par l'interface.
- Une règle de calcul nouvelle ou modifiée s'accompagne d'un test dont le résultat attendu a été posé à la main, et non produit par le code lui-même.

## 2. Sécurité

- Requêtes SQL paramétrées, sans exception.
- Validation des entrées côté serveur, par schéma, avant toute utilisation.
- La propriété d'une ressource se prouve dans la requête SQL, à partir de l'utilisateur authentifié. Une ressource appartenant à quelqu'un d'autre est indiscernable d'une ressource inexistante.
- Mots de passe hachés, jamais journalisés, jamais renvoyés.
- Secrets exclusivement en variables d'environnement, hors dépôt. Un secret qui a été poussé est considéré comme compromis et se révoque, il ne se retire pas de l'historique.
- Les messages d'erreur destinés au client ne révèlent ni la pile d'appel, ni la structure interne, ni l'existence d'un compte.
- Les écritures concurrentes sur une même position sont sérialisées ; un invariant métier ne se vérifie jamais hors transaction.

## 3. Accessibilité

Cible : RGAA, niveau AA sur les critères applicables.

- Contraste minimal de 4,5:1 pour le texte courant, 3:1 pour les éléments d'interface.
- Toute information portée par la couleur l'est aussi par le texte ou la forme.
- Chaque champ a une étiquette explicite ; les erreurs de saisie sont annoncées et rattachées au champ.
- Navigation complète au clavier, ordre de tabulation cohérent, focus visible, pièges de focus fermés dans les fenêtres modales.
- Zones interactives d'au moins 44 x 44 px en mobile.
- Animations réduites si le système le demande.

## 4. Tests

- La logique métier se teste sans base de données ni serveur HTTP : les services reçoivent leurs dépendances plutôt que de les chercher.
- Les règles de cloisonnement, les invariants de solde et les transactions se testent contre une vraie base PostgreSQL.
- Les composants d'interface se testent sur ce que voit et fait l'utilisateur, pas sur leur état interne.
- Un défaut corrigé laisse derrière lui un test qui échouait avant la correction.

## 5. Performance et exploitation

- Une panne de cache dégrade le service, elle ne le casse pas.
- Une panne d'un fournisseur de cours est visible pour l'utilisateur, datée, et n'empêche pas le reste de s'afficher.
- Les appels sortants sont bornés dans le temps.
- Un incident doit pouvoir se diagnostiquer après coup : ce que les journaux ne disent pas est perdu.

## 6. Niveau de preuve attendu

| Risque du changement | Preuve demandée |
|---|---|
| Texte, commentaire, documentation | aucune, au-delà des contrôles automatiques |
| Interface sans règle métier | une capture du parcours, mobile et bureau si les deux sont touchés |
| Règle de calcul, modèle de données | un test dont le résultat attendu est posé à la main, et le détail du calcul dans la pull request |
| Sécurité, authentification, autorisations | un test qui échoue sans le correctif, et la démonstration du cas d'abus fermé |
| Performance | une mesure avant et après, dans les mêmes conditions |
| Exploitation, déploiement, migration | la sortie de commande réelle, et la procédure de retour en arrière |

## 7. Ce qui n'est pas exigé

La couverture de tests n'est pas un objectif en soi, et aucun seuil chiffré n'est imposé : un test qui n'échouerait jamais ne protège rien. La perfection documentaire n'est pas non plus un objectif : un document qui n'est pas tenu à jour vaut moins que son absence, puisqu'il trompe son lecteur.
