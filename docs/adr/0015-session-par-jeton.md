# 0015 — Session par jeton : stockage, expiration, révocation

- **Date** : 30 juillet 2026, révisée les 5 et 6 septembre 2026
- **Statut** : à réexaminer

## Contexte

L'API est sans état et sert une interface monopage. Un jeton signé porte l'identité. Restent trois questions, qui ont chacune été tranchées à des moments différents : où le client garde ce jeton, combien de temps il vaut, et comment le rendre invalide avant son expiration.

Le stockage en mémoire de l'onglet, retenu d'abord, déconnectait l'utilisateur à chaque rechargement de page, ce qui était intenable à l'usage. Le stockage local, lui, survit à tout et reste lisible par n'importe quel script de la page.

## Décision

- Le jeton est conservé dans le **stockage de session du navigateur** : il survit au rechargement et à la navigation, jamais à la fermeture de l'onglet. Ce choix n'a été arrêté qu'une fois posée une politique de sécurité du contenu stricte, sans script en ligne.
- Il est transmis en en-tête `Authorization`, jamais en cookie : il n'y a donc pas de surface CSRF.
- Sa durée de validité est de deux heures, sans renouvellement.
- La **révocation** est portée par une borne temporelle sur le compte : chaque requête authentifiée relit l'utilisateur par sa clé primaire, refuse un compte désactivé ou supprimé, et refuse tout jeton émis avant la borne. Celle-ci est posée au changement de mot de passe, et peut l'être à la main pour couper l'accès d'un compte compromis. Une borne, plutôt qu'une liste de jetons révoqués : un jeton porte sa date d'émission, il suffit de la comparer.
- Un changement de mot de passe réémet un jeton pour la session courante : les autres sessions tombent, ce qui est l'effet attendu.

## Conséquences

- Un jeton lisible par les scripts de la page reste exposé si une faille d'injection existe ; la politique de sécurité du contenu est la contre-mesure, elle n'est pas une garantie absolue.
- Deux heures sans renouvellement, et une session perdue à la fermeture de l'onglet, sont une gêne réelle pour un usage quotidien.
- Chaque requête authentifiée coûte une lecture en base. C'est le prix de la révocation effective.
- **À réexaminer** : un jeton d'accès court accompagné d'un renouvellement en cookie `HttpOnly` est l'alternative évidente, mais elle déplace le risque vers la falsification de requête, la rotation et la réutilisation du jeton de renouvellement. Elle ne sera instruite qu'après un modèle de menace explicite et le choix d'un hébergement, dont dépendent les réglages de cookie.
