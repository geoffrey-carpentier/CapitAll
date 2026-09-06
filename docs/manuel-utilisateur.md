# Manuel utilisateur — CapitAll

> Document destiné à l'utilisateur final, appelé par la checklist de l'examen (étape 8, documentation) et par `docs/planning.md`.
> **État au 03/09/2026 :** les sept parcours du MVP sont décrits à partir de
> l'application livrée. Les annonces et l'administration sont hors MVP.

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
2. Une vente ne peut jamais rendre la quantité négative à sa date, même si un achat
   ultérieur existe ou si plusieurs ventes sont envoyées en même temps.
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
| Une quantité de métal | jusqu'à quatre décimales, en onces troy |
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

**Patrimoine.** La valeur totale, les plus-values, la courbe par période et la
répartition par classe sont regroupées sur l'écran d'arrivée. Le bouton central `+` en
mobile, ou `+ Mouvement` en bureau, ouvre la saisie sans quitter ce contexte.

**Positions.** La liste mobile devient un tableau comparable en bureau. Touchez ou
activez une ligne pour ouvrir son détail. Le tri est disponible dans le menu mobile et
dans les en-têtes du tableau.

**Détail d'une position.** L'écran réunit quantité, cours, prix de revient,
valorisation, historique de cours, mouvements et seuils de l'actif. Les commandes de
suppression demandent une confirmation.

**Saisir un mouvement.** Choisissez achat, vente ou sortie, l'actif, la quantité, le
prix, les frais et la date. Un récapitulatif calculé par le serveur montre l'effet avant
enregistrement. Un mouvement invalide reste refusé sans rien écrire.

**Frais prélevés autrement qu'en euros.** Dès que vous saisissez un montant de frais,
l'application vous demande dans quoi ils ont été retenus. Trois réponses possibles.

En **euros**, il n'y a rien de plus à faire. Dans **l'actif de l'opération** — le cas des
plateformes de cryptomonnaies, qui retiennent leur part dans ce qu'elles vous vendent —
saisissez la quantité que vous avez **réellement reçue** et les frais retenus : la
conversion en euros se fait au prix de l'opération, et le récapitulatif vous l'annonce
avant validation. Dans un **autre actif**, indiquez son symbole et ce que ces frais
valaient en euros ce jour-là : l'application ne le devine pas, aucun taux ne se lisant
dans le mouvement.

Dans les trois cas, la quantité que vous saisissez est celle qui entre ou sort
réellement de votre position. Vous n'avez jamais à la corriger pour tenir compte des
frais.

**Mot de passe oublié.** Le lien « Mot de passe oublié ? » de l'écran de connexion demande
une clé de réinitialisation. Le message affiché est le même que votre adresse corresponde
ou non à un compte : c'est voulu, il empêche d'utiliser ce formulaire pour découvrir qui
est inscrit. La clé vaut une heure et ne sert qu'une fois ; en demander une nouvelle annule
la précédente.

En mode démonstration, la clé s'affiche directement à l'écran plutôt que d'être envoyée par
courriel — l'application ne dispose pas de service d'envoi. L'écran vous le signale.

Choisir un nouveau mot de passe **ferme toutes vos sessions** et ne vous connecte pas :
vous vous reconnectez avec celui que vous venez de choisir, ce qui vérifie au passage que
vous l'avez bien enregistré.

**Changer son mot de passe depuis son compte.** L'opération ferme vos autres sessions —
c'est ce qu'on attend de « je change mon mot de passe parce que je le crois compromis » —
mais laisse ouverte celle depuis laquelle vous agissez.

**Trop de tentatives.** Après dix échecs de connexion sur une même adresse en un quart
d'heure, les tentatives suivantes sont refusées pendant quelques minutes. Une connexion
réussie remet le compteur à zéro.

**Corriger un mouvement.** Chaque mouvement de la frise porte deux commandes, Corriger
et Supprimer. Corriger rouvre la feuille sur ce mouvement, préremplie de ses valeurs :
changez ce qui doit l'être, le récapitulatif vous montre l'effet sur votre position avant
que vous ne validiez.

Une correction qui rendrait un mouvement suivant impossible est refusée, et rien n'est
modifié. C'est le cas si vous réduisez un achat sous une vente qui en dépend : corrigez
d'abord la vente, ou supprimez-la.

L'actif du mouvement ne se change pas. Un mouvement appartient à l'histoire d'une
position, et l'en détacher laisserait celle-ci avec un prix de revient calculé sur un
mouvement qu'elle n'a plus. Si vous vous êtes trompé de position, supprimez le mouvement
et ressaisissez-le sur la bonne.

**Renommer une position.** Le nom affiché en haut de la fiche est celui que vous avez
saisi. Le bouton « Renommer » permet de le changer à tout moment. Le symbole et la classe,
eux, ne changent pas : ce sont eux qui identifient l'actif auprès des fournisseurs de
cours.

**Transferts et retraits.** Le sens « Sortie » sert lorsque des unités quittent la
position sans être vendues : virement vers un autre portefeuille, retrait, frais de
réseau. La quantité diminue, le prix de revient des unités restantes ne bouge pas, et
aucune plus-value n'est produite — vous n'avez rien vendu. La valeur qui quitte le
portefeuille est comptée à part, sous le nom « valeur sortie du portefeuille ».

Avant cette possibilité, un retrait ne pouvait s'enregistrer qu'en vente à zéro euro : le
montant était juste, l'étiquette était fausse, et votre relevé affichait une vente que
vous n'aviez pas faite.

**Seuils.** Les seuils franchis et ceux en cours sont séparés, et visibles ensemble. Un
seuil peut viser le cours d'un actif ou le capital total. Il peut être retiré, mais aucun
message externe n'est envoyé. Le fonctionnement complet est détaillé en section 8.

**Compte.** Cinq sections couvrent les informations du compte, la sécurité,
l'affichage, l'export CSV des mouvements et les informations sur l'application. La
suppression exige le mot de passe et efface définitivement les données du compte.

## 8. Comprendre les seuils

C'est la fonction la plus facile à mal comprendre, parce que son nom évoque ailleurs une
notification. Voici exactement ce qu'elle fait, et ce qu'elle ne fait pas.

### Ce qu'un seuil surveille

Un seuil vise **l'une ou l'autre** de deux choses, jamais les deux à la fois :

- **le cours d'un actif** — le prix d'une unité, et non la valeur de votre position. Un
  seuil posé à 70 000 € sur le bitcoin se déclenche quand le bitcoin vaut 70 000 €,
  quelle que soit la quantité que vous en détenez ;
- **votre capital total** — la valeur de l'ensemble de votre patrimoine.

Vous choisissez aussi le sens : « au-dessus » ou « en dessous ». La valeur du seuil doit
être strictement positive.

### Quand il est évalué

**Au moment où vous consultez votre patrimoine**, et à ce moment seulement. Aucune tâche
ne tourne en arrière-plan, aucun programme ne surveille les cours pendant que vous n'êtes
pas connecté. Vos seuils sont donc examinés avec les valeurs qui viennent d'être
calculées pour l'écran que vous ouvrez.

Conséquence directe, et il vaut mieux la connaître : si un cours monte puis redescend
entre deux de vos visites, le franchissement n'est pas constaté. L'application vous dit
ce qu'elle observe quand vous la regardez, pas ce qui s'est passé en votre absence.

### Comment le franchissement est décidé

Le franchissement est **inclusif** : un seuil « au-dessus de 70 000 » se déclenche à
70 000 exactement, pas seulement au-delà. C'est ce que veut dire quelqu'un qui fixe ce
chiffre.

Un seuil déjà franchi **n'est plus réévalué**. Il conserve la date de son premier
franchissement, qui est l'information utile ; la réévaluer l'écraserait. Un seuil ne se
déclenche donc qu'une fois.

Si le cours de la cible est indisponible au moment de la consultation, **le seuil n'est
pas évalué du tout**. Il n'est ni déclenché, ni considéré comme non franchi : une valeur
inconnue n'est pas traitée comme une valeur nulle, ce qui produirait des franchissements
faux.

### Ce que l'écran affiche

Les seuils sont présentés en deux groupes visibles ensemble, les franchis puis ceux en
cours. Chaque ligne en cours indique **l'écart restant** : le pourcentage que la valeur
observée doit encore parcourir pour atteindre le seuil. Un seuil déjà atteint affiche un
écart nul plutôt qu'un nombre négatif, qui n'aurait pas de sens. Quand la valeur observée
est indisponible, l'écart n'est pas affiché du tout.

Une barre de progression accompagne l'écart, mais elle ne le porte jamais seule : le
pourcentage est toujours écrit à côté, en toutes lettres.

### Ce que l'application ne fait pas avec vos seuils

- Elle **n'envoie rien** : ni courriel, ni notification poussée, ni SMS, ni message
  interne. Un franchissement se lit à l'écran, et nulle part ailleurs.
- Elle **ne surveille pas en continu** : il n'existe aucune évaluation planifiée.
- Elle **ne réarme pas** un seuil déjà déclenché. Vous pouvez le retirer et en créer un
  nouveau ; il n'existe pas de commande qui remette un seuil franchi à l'état actif.
- Elle **n'agit pas** sur votre portefeuille : un seuil ne déclenche aucun ordre, aucune
  vente, aucun achat.

C'est aussi pourquoi le mot « alerte » n'apparaît pas dans l'interface : il promettrait
un avertissement que l'application n'envoie pas.

## 9. Questions fréquentes

**On m'a déconnecté sans que ma session ait expiré : pourquoi ?** Votre compte a été
désactivé, ou son mot de passe a été changé ailleurs. L'écran de connexion vous en donne la
raison si vous réessayez.

**Pourquoi mon prix de revient n'a-t-il pas changé après ma vente ?** Parce qu'une
vente ne change pas le coût des unités restantes ; elle produit une plus-value réalisée.

**Je me suis trompé de prix sur un achat ancien : dois-je tout ressaisir ?** Non.
Utilisez « Corriger » sur ce mouvement. Les ventes qui en dépendent gardent leur date,
leur note et leur place dans la frise, et votre prix de revient est recalculé.

**Pourquoi ne puis-je pas suivre n'importe quelle action ?** Les actions sont limitées à
la liste que le fournisseur de cours dessert sur son offre gratuite. Le champ vous
propose directement cette liste, avec la date à laquelle elle a été vérifiée. Pour les
cryptomonnaies et les devises, la saisie reste libre : c'est le fournisseur qui répond,
et l'application vous le dit au premier relevé de cours.

**J'ai transféré des unités vers un autre portefeuille : dois-je saisir une vente ?**
Non. Utilisez le sens « Sortie ». Une vente ferait apparaître une plus-value que vous
n'avez pas réalisée, et fausserait votre résultat.

**Ma plateforme a retenu ses frais en cryptomonnaie : quelle quantité saisir ?** Celle
que vous avez reçue, et les frais dans leur unité. Si vous avez commandé pour 1 000 € à
2 500 € l'unité et reçu 0,398 après 0,002 de frais, saisissez 0,398, un prix de 2 500 et
0,002 de frais en choisissant l'actif de l'opération. Votre position affichera 0,398,
comme votre plateforme, et votre coût sera bien de 1 000 €.

**Pourquoi une position affiche-t-elle un cours ancien ?** Le fournisseur était
indisponible. L'application indique alors la date du dernier cours connu au lieu de
présenter une valeur faussement fraîche.

**Pourquoi suis-je déconnecté quand je rafraîchis la page ?** Le jeton reste en mémoire
et n'est pas conservé dans le stockage du navigateur.

**La bascule en dollars change-t-elle mes calculs ?** Non. Elle ne transforme que
l'affichage ; l'euro reste la devise de calcul.

**Pourquoi mes pourcentages sont-ils identiques en euros et en dollars ?** Parce qu'un
pourcentage est un rapport entre deux montants. Votre performance vaut, par exemple, la
plus-value divisée par ce que la position vous a coûté. La bascule multiplie ces deux
montants par le même taux de change : le taux se simplifie et le rapport ne change pas.
Ce n'est pas un défaut d'affichage, c'est au contraire la preuve que la conversion ne
touche pas au calcul — seuls les montants changent, jamais les rapports entre eux.

**Mes courbes sont-elles converties au taux de chaque jour ?** Non, et c'est une limite
qu'il vaut mieux connaître. L'historique est enregistré en euros, puis converti au taux
du moment où vous le regardez. Une courbe affichée en dollars n'est donc pas l'historique
réel en dollars : c'est l'historique en euros, relu au taux d'aujourd'hui.

**Que se passe-t-il si je supprime un mouvement ?** La position, le prix de revient et
les plus-values sont recalculés depuis l'historique restant.

**Puis-je récupérer mes données si je supprime mon compte ?** Non. Exportez d'abord le
CSV si vous souhaitez conserver la liste des mouvements.

## 10. Ce que l'application ne fait pas

Le dire explicitement évite les attentes déçues.

Elle ne passe pas d'ordres et ne se connecte à aucune plateforme. Elle n'importe pas de
relevés : les mouvements se saisissent à la main. Elle n'envoie ni courriel ni
notification. Elle relève au plus une fois par jour la valeur du portefeuille et le
cours des positions consultées ; ce n'est pas un historique de marché exhaustif. Elle
ne fournit aucun conseil en investissement.
