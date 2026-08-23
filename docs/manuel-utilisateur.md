# Manuel utilisateur — CapitAll

> Document destiné à l'utilisateur final, appelé par la checklist de l'examen (étape 8, documentation) et par `docs/planning.md`.
> **État au 20/08/2026 :** les parties qui décrivent des notions et des règles sont rédigées et stables, elles ne dépendent pas de l'avancement du code. Les parties qui décrivent un écran sont écrites au fur et à mesure que l'écran existe, et sont signalées comme telles. Un manuel qui décrirait un écran non livré serait faux le jour où le jury l'ouvre.

## 1. Ce que fait l'application

CapitAll réunit sur un même écran ce que vous détenez, quelle que soit la classe : cryptomonnaies, devises, métaux précieux et actions. Elle interroge les cours du marché, valorise chaque position, et calcule ce que vous avez réellement gagné ou perdu.

Elle ne passe aucun ordre, ne se connecte à aucun compte bancaire ou plateforme d'échange, et ne fournit aucun conseil en investissement. Vous saisissez vos mouvements, elle calcule.

## 2. Les cinq notions à connaître

Ces cinq mots reviennent partout dans l'application. Ils sont employés avec un sens précis et toujours le même.

**Patrimoine.** La valeur totale de tout ce que vous détenez, à l'instant de la consultation.

**Position.** Ce que vous détenez d'un actif donné : une quantité, un prix de revient, une valeur actuelle. Vous avez une position en bitcoin, une autre en or.

**Actif.** L'instrument lui-même : le bitcoin, l'or, une action. Un actif existe indépendamment de ce que vous en détenez.

**Mouvement.** Un achat ou une vente. C'est la seule chose que vous saisissez ; tout le reste en découle.

**Seuil.** Une valeur que vous surveillez. L'application constate son franchissement quand vous consultez votre portefeuille. **Elle ne vous envoie rien** : ni courriel, ni notification, ni message. C'est un choix assumé, et c'est aussi pourquoi le mot « alerte » n'apparaît nulle part.

## 3. Le prix de revient, et pourquoi il ne bouge pas quand vous vendez

C'est le point le plus important du manuel, et celui qui surprend le plus souvent.

Votre **prix de revient** est la moyenne de ce que vous avez payé, pondérée par les quantités, frais compris. Si vous achetez 0,5 bitcoin à 54 000 € avec 15 € de frais, puis 0,3 bitcoin à 61 000 € avec 10 € de frais, vous avez dépensé 45 325 € pour 0,8 bitcoin : votre prix de revient est de 56 656,25 € l'unité.

Quand vous vendez, **ce prix ne change pas**. Vendre ne modifie pas ce qu'ont coûté les unités qui vous restent. La vente diminue la quantité détenue et dégage une **plus-value réalisée**, calculée sur les seules unités cédées. Beaucoup de feuilles de calcul se trompent ici en recalculant le prix de revient après une vente : le résultat est faux, et l'erreur est silencieuse.

L'application distingue donc deux plus-values, et vous les verrez toujours séparées :

- la **plus-value latente**, sur ce que vous détenez encore, qui varie avec les cours ;
- la **plus-value réalisée**, sur ce que vous avez vendu, qui est acquise et ne bouge plus.

## 4. Les six règles que l'application applique

Elles sont rappelées à l'écran au moment où elles s'appliquent, pour qu'aucun comportement ne vous surprenne.

1. Le prix de revient est une moyenne pondérée ; une vente ne le modifie pas.
2. Une vente ne peut pas excéder la quantité que vous détenez.
3. Un seuil est inclusif — il se déclenche à la valeur exacte — et ne se déclenche qu'une fois.
4. Les seuils sont évalués quand vous consultez votre portefeuille, aucun envoi n'est effectué.
5. Quand un cours est indisponible, la dernière valeur connue est utilisée, et l'écran vous le signale avec sa date. Une position n'est jamais valorisée à zéro parce qu'un fournisseur ne répond pas.
6. La devise de référence des calculs est l'euro. La bascule euro-dollar ne change que l'affichage, jamais le calcul.

## 5. Comment les chiffres sont affichés

Les quatre classes d'actifs ne se mesurent pas de la même façon, et l'application ne leur applique pas la même précision.

| Ce que vous lisez | Précision affichée |
|---|---|
| Un montant en euros | deux décimales au maximum, les zéros inutiles sont retirés |
| Une quantité de cryptomonnaie | jusqu'à huit décimales |
| Une quantité de métal | jusqu'à trois décimales, en grammes |
| Une quantité d'actions | en titres |
| Une quantité de devise | deux décimales, avec le code international |
| Un cours unitaire | de deux à six décimales selon son ordre de grandeur |
| Un pourcentage | une décimale au maximum |

Une valeur non nulle mais inférieure au centime s'affiche `0,01 €` et non `0 €`, pour ne pas laisser croire à une absence de valeur. Une part inférieure à un dixième de pour cent s'affiche `< 0,1 %`.

Les variations portent toujours un signe et une flèche, jamais la couleur seule. Vous pouvez lire l'application en noir et blanc sans perdre d'information.

## 6. Premiers pas

*Rédigé, ces écrans existent.*

**Créer un compte.** Adresse électronique, pseudonyme et mot de passe d'au moins dix caractères. La robustesse du mot de passe s'affiche pendant la saisie. La connexion est automatique après l'inscription.

**Se connecter.** Adresse et mot de passe. En cas d'erreur, le message ne précise jamais si c'est l'adresse ou le mot de passe qui est en cause : c'est volontaire, cela empêche de découvrir quels comptes existent.

**Un point à connaître.** Votre session ne survit pas à un rechargement de page. C'est le contrepoids d'un choix de sécurité : votre jeton d'accès n'est jamais écrit dans votre navigateur, il vit uniquement le temps de la visite. Rien de ce que vous avez saisi n'est perdu, seule la session est à rouvrir.

**Le premier écran.** Un compte neuf n'affiche ni graphique ni répartition, ce qui n'aurait aucun sens sans données, mais un texte court et une seule action : ajouter votre première position.

## 7. Écran par écran

*À compléter au fur et à mesure des livraisons. Chaque section décrit ce que l'écran affiche, ce que vous pouvez y faire, et ce qui se passe dans les cas particuliers.*

- **Patrimoine** — rédigé dès que l'écran est stabilisé.
- **Positions** — à rédiger.
- **Détail d'une position** — à rédiger.
- **Saisir un mouvement** — à rédiger. Insistera sur le récapitulatif recalculé en direct, qui montre le nouveau prix de revient **avant** validation.
- **Seuils** — à rédiger.
- **Compte** — à rédiger. Couvrira le changement de mot de passe, la devise d'affichage, le masquage des montants et la suppression du compte.

## 8. Questions fréquentes

*Trame à compléter en fin de projet, alimentée par les questions réellement posées lors des essais.*

- Pourquoi mon prix de revient n'a-t-il pas changé après ma vente ?
- Pourquoi une position affiche-t-elle « cours différé » ?
- Pourquoi suis-je déconnecté quand je rafraîchis la page ?
- La bascule en dollars change-t-elle mes calculs ?
- Que se passe-t-il si je supprime un mouvement ?
- Puis-je récupérer mes données si je supprime mon compte ?

## 9. Ce que l'application ne fait pas

Le dire explicitement évite les attentes déçues.

Elle ne passe pas d'ordres et ne se connecte à aucune plateforme. Elle n'importe pas de relevés : les mouvements se saisissent à la main. Elle n'envoie ni courriel ni notification. Elle ne conserve pas l'historique des cours passés, seulement des instantanés de la valeur de votre portefeuille. Elle ne fournit aucun conseil en investissement, et ne le fera pas.
