# Cahier des charges - CapitAll

| Version | Date | Nature de la révision |
|---|---|---|
| 1.0 | 14/07/2026 | rédaction initiale |
| 1.1 | 21/07/2026 | fournisseurs de cours révisés, fiche d'actif enrichie |
| 1.2 | 29/07/2026 | plus-value réalisée, bascule d'affichage euro/dollar, routes du portefeuille |
| 2.0 | 30/07/2026 | restructuration complète : acteurs, règles de gestion, exigences non fonctionnelles détaillées, critères de recette, matrice de traçabilité, glossaire |

## 1. Objet et portée du document

Ce document définit ce que CapitAll doit faire, dans quelles limites, et à quelles conditions le résultat sera considéré comme conforme. Il sert de référence unique en cas de doute sur le périmètre.

Il ne décrit ni l'architecture technique détaillée, ni le modèle de données complet, ni le calendrier : ces éléments relèvent des documents cités en annexe, auxquels il renvoie plutôt que de les recopier.

Les décisions structurantes sont référencées par leur identifiant, de la forme D12, et consignées dans le registre de décisions du projet. Ce registre fait foi : lorsqu'une décision révise une décision antérieure, c'est la plus récente qui s'applique.

## 2. Contexte et enjeux

### 2.1 Constat

Un particulier qui diversifie son épargne se retrouve avec autant de vues partielles que de plateformes : un compte d'échange pour les cryptomonnaies, une banque pour les devises, un négociant pour les métaux, un courtier pour les actions. Aucun de ces acteurs n'a de vision de l'ensemble, et aucun n'a d'intérêt à la fournir.

La consolidation se fait donc à la main, le plus souvent dans un tableur. Les cours y sont recopiés au gré des connexions, les prix de revient sont approximatifs, et les plus-values affichées sont rarement exactes.

### 2.2 Problématique

Comment offrir à un particulier une vue consolidée, à jour et fiable de son patrimoine multi-actifs, sans ressaisie manuelle des cours et avec des calculs de rentabilité exacts ?

### 2.3 Objectifs

| # | Objectif | Comment il est atteint |
|---|---|---|
| O1 | Centraliser des actifs de nature différente | quatre classes gérées par un modèle commun, ramenées à une unité de compte unique |
| O2 | Supprimer la ressaisie des cours | récupération automatique auprès de fournisseurs externes, appelés côté serveur |
| O3 | Garantir l'exactitude des calculs | arithmétique exacte de bout en bout, aucun calcul monétaire en virgule flottante |
| O4 | Rendre le patrimoine consultable en mobilité | conception mobile-first, et non adaptation a posteriori d'une interface de bureau |
| O5 | Protéger des données patrimoniales sensibles | authentification, cloisonnement strict par utilisateur, validation systématique des entrées |

### 2.4 Acteurs

| Acteur | Description | Ce qu'il peut faire | Ce qu'il ne peut pas faire |
|---|---|---|---|
| **Visiteur** | personne non authentifiée | créer un compte, se connecter | accéder à la moindre donnée patrimoniale |
| **Utilisateur** | particulier gérant un patrimoine diversifié, à l'aise avec une application web, sans formation financière particulière | gérer ses actifs, ses transactions, ses alertes ; consulter son portefeuille et les annonces | accéder aux données d'un autre utilisateur |
| **Administrateur** | responsable du service | publier et gérer les annonces, lister et désactiver des comptes | consulter les portefeuilles, transactions ou alertes d'autrui |
| **Fournisseur de cours** | acteur externe, non humain | fournir un cours sur interrogation | rien d'autre : l'application ne lui transmet aucune donnée |

Le modèle de rôles est volontairement minimal. Deux rôles suffisent au besoin réel, et le rôle d'administration est conçu à moindre privilège strict : il ouvre des capacités de gestion du service, jamais d'accès aux données patrimoniales (D23).

## 3. Périmètre

### 3.1 Fonctionnalités retenues

| Domaine | Fonctionnalité | Référence |
|---|---|---|
| Compte | inscription, connexion, cloisonnement des données | D7 |
| Actifs | suivi d'actifs sur quatre classes : cryptomonnaie, devise, métal précieux, action | D9, D20 |
| Transactions | enregistrement des achats et des ventes, suppression d'une saisie erronée | D9, D51 |
| Valorisation | prix de revient moyen pondéré, plus-value latente, plus-value réalisée | D8, D42, D54 |
| Cours | récupération automatique auprès de fournisseurs externes, mise en cache | D5, D6, D14 |
| Portefeuille | tableau de bord consolidé, répartition par classe, courbe d'évolution | D16 |
| Affichage | bascule euro ou dollar, à l'affichage uniquement | D43 |
| Alertes | seuils sur un actif ou sur le capital total, évaluation automatique | D15, D50, D56 |
| Historique | instantané de valorisation journalier | D16, D49 |
| Annonces | fil d'annonces internes publiées par l'administration | D22 |
| Actions | liste blanche de valeurs américaines, fiche d'actif enrichie | D20, D26, D27 |
| Administration | gestion des annonces, liste et désactivation de comptes | D23, D60 |

### 3.2 Fonctionnalités écartées

Un périmètre se définit autant par ce qu'il exclut que par ce qu'il inclut.

| Écartée | Motif |
|---|---|
| Recherche libre de symboles boursiers et de fonds indiciels | dépendance non maîtrisée aux quotas des fournisseurs ; une liste blanche bornée démontre la même capacité |
| Export fiscal | complexité réglementaire sans rapport avec l'objectif du produit |
| Devise de référence multiple | impliquerait un prix de revient et un historique par devise. La bascule d'affichage retenue couvre le besoin d'usage à un coût sans commune mesure (D43) |
| Import de transactions par fichier | le coût ne tient pas dans la lecture du fichier mais dans les formats hétérogènes, la correspondance des colonnes, les rejets partiels et la détection des doublons. Reporté à une version ultérieure (D44) |
| Notifications par courriel ou notification poussée | infrastructure supplémentaire sans valeur ajoutée pour le besoin exprimé |
| Publications par les utilisateurs | le produit n'est pas un réseau social |
| Widget de marché externe embarqué | dépendance réseau supplémentaire et exception de sécurité contraires aux principes retenus (D24) |

### 3.3 Hypothèses retenues

- L'utilisateur saisit lui-même ses transactions. Aucune connexion à un compte bancaire ou à une plateforme d'échange n'est prévue.
- Les cours sont ceux publiés par des sources publiques gratuites. Ils ne constituent pas une donnée contractuelle et peuvent différer de ceux d'une plateforme de négociation.
- La devise de référence des calculs est l'euro (D11).
- Le volume de données par utilisateur reste modeste : quelques dizaines d'actifs, quelques centaines de transactions.

## 4. Exigences fonctionnelles

### 4.1 Gestion du compte

- En tant que visiteur, je veux créer un compte avec une adresse électronique et un mot de passe, afin de disposer de mon propre espace. Contraintes : adresse au format valide et non déjà utilisée, mot de passe d'une longueur minimale contrôlée côté serveur, message explicite si l'adresse est déjà prise.
- En tant qu'utilisateur inscrit, je veux me connecter, afin de retrouver mon portefeuille. Contraintes : message d'échec strictement générique, ne révélant jamais si c'est l'adresse ou le mot de passe qui est en cause ; soumission verrouillée pendant l'appel réseau.
- En tant qu'utilisateur connecté, je veux consulter les informations de mon compte, afin de vérifier mon identité applicative.

### 4.2 Gestion des actifs

- En tant qu'utilisateur connecté, je veux ajouter un actif à suivre en précisant sa classe, son symbole et son nom, afin d'y enregistrer des transactions. Contraintes : un même symbole ne peut être suivi deux fois, la classe est restreinte aux quatre valeurs autorisées.
- En tant qu'utilisateur connecté, je veux renommer un actif, afin de corriger une saisie ou d'adopter une appellation qui me parle.
- En tant qu'utilisateur connecté, je veux supprimer un actif, afin de retirer une ligne devenue sans objet. Contrainte : la suppression emporte les transactions et les alertes qui s'y rattachent, et l'utilisateur en est averti.
- En tant qu'utilisateur connecté, je veux consulter le détail d'un actif, avec l'historique de ses transactions, son prix de revient, son cours et ses plus-values, afin de suivre sa performance individuelle.
- En tant qu'utilisateur connecté, je veux voir les informations de contexte d'une action, afin de situer ma position sans quitter l'application. Contrainte : ces données proviennent de la même réponse que le cours, sans appel supplémentaire ; elles n'existent pas pour les devises et les métaux, la fiche s'adapte donc à la classe d'actif.

### 4.3 Gestion des transactions

- En tant qu'utilisateur connecté, je veux enregistrer un achat ou une vente en précisant la quantité, le prix unitaire, les frais et la date, afin que mon prix de revient et mes plus-values soient recalculés. Contraintes : quantité strictement positive, prix positif ou nul, frais positifs ou nuls, date non postérieure au jour courant, impossibilité de vendre plus que la quantité détenue.
- En tant qu'utilisateur connecté, je veux supprimer une transaction saisie par erreur, afin que mes calculs redeviennent justes. Sans cette possibilité, une saisie erronée fausserait définitivement le prix de revient (D51).

### 4.4 Portefeuille et valorisation

- En tant qu'utilisateur connecté, je veux consulter un tableau de bord consolidé présentant la valeur totale de mon patrimoine, sa répartition par classe d'actif et son évolution, afin d'avoir une vue d'ensemble immédiate.
- En tant qu'utilisateur connecté, je veux distinguer ma plus-value latente de ma plus-value réalisée, afin de savoir ce que j'ai effectivement gagné de ce que je gagnerais si je vendais aujourd'hui.
- En tant qu'utilisateur connecté, je veux basculer l'affichage entre euro et dollar, afin de lire mon patrimoine dans l'une ou l'autre devise. Contrainte : la bascule ne touche que l'affichage. Les montants restent calculés et conservés en euro, et l'historique est converti au taux courant (D43).
- En tant qu'utilisateur connecté, je veux visualiser l'évolution de mon patrimoine dans le temps, afin de juger de la pertinence de mes choix.
- En tant qu'utilisateur connecté, je veux être informé lorsqu'un cours n'a pas pu être obtenu, afin de ne pas prendre une valeur incomplète pour une valeur exacte. Contrainte : une valeur inconnue n'est jamais présentée comme une valeur nulle.

### 4.5 Alertes

- En tant qu'utilisateur connecté, je veux définir un seuil sur le cours d'un actif ou sur mon capital total, afin d'être informé sans consulter l'application en permanence. Contraintes : seuil strictement positif ; une alerte cible soit un actif précis, soit le capital total, jamais les deux ni aucun des deux.
- En tant qu'utilisateur connecté, je veux consulter mes alertes et savoir lesquelles ont été franchies, ainsi que la date du franchissement.
- En tant qu'utilisateur connecté, je veux désactiver une alerte, afin de garder une liste pertinente.

### 4.6 Annonces

- En tant qu'utilisateur connecté, je veux consulter les annonces publiées par l'administration, afin d'être informé des évolutions du service. Contrainte : lecture seule, les annonces épinglées apparaissant en tête.

### 4.7 Administration

- En tant qu'administrateur, je veux publier, modifier, épingler et supprimer des annonces, afin de communiquer avec les utilisateurs. Contraintes : titre et contenu obligatoires, action réservée au rôle d'administration.
- En tant qu'administrateur, je veux lister les comptes et désactiver un compte en cas d'abus, afin d'assurer la gestion du service. Contraintes : aucune donnée patrimoniale n'est visible dans cette liste ; la désactivation est logique et réversible, elle ne supprime aucune donnée et empêche seulement la connexion (D60).

### 4.8 Règles de gestion

Ces règles s'appliquent en toute circonstance et sont vérifiées côté serveur, quelle que soit l'interface utilisée.

| # | Règle | Portée |
|---|---|---|
| RG1 | Un utilisateur n'accède qu'à ses propres données, en lecture comme en écriture | toutes les ressources patrimoniales |
| RG2 | Un même symbole ne peut être suivi deux fois par le même utilisateur | actifs |
| RG3 | On ne peut pas vendre une quantité supérieure à celle détenue | transactions |
| RG4 | Une transaction ne peut pas être datée dans le futur | transactions |
| RG5 | Le prix de revient et les plus-values ne sont jamais conservés en base, ils sont recalculés depuis les transactions | valorisation |
| RG6 | Le prix de revient intègre les frais d'achat ; une vente ne le modifie pas | valorisation |
| RG7 | Les transactions sont prises en compte dans l'ordre chronologique, indépendamment de leur ordre de saisie | valorisation |
| RG8 | Un instantané de valorisation est unique par utilisateur et par jour | historique |
| RG9 | Une alerte cible soit un actif, soit le capital total, jamais les deux ni aucun des deux | alertes |
| RG10 | Un seuil est franchi de manière inclusive : atteindre le seuil suffit à déclencher l'alerte | alertes |
| RG11 | Une alerte déjà déclenchée n'est plus réévaluée, et une alerte dont le cours est indisponible n'est pas évaluée | alertes |
| RG12 | Le rôle d'un compte n'est accepté dans aucune entrée utilisateur | sécurité |

La règle RG3 ne peut pas être exprimée par une contrainte de base de données : elle porte sur la somme de plusieurs lignes et non sur une ligne isolée. Elle est donc vérifiée dans la couche métier. Cette distinction entre ce que le modèle relationnel garantit et ce qui relève de l'application est assumée et documentée.

## 5. Exigences non fonctionnelles

### 5.1 Sécurité

| Exigence | Mise en œuvre attendue |
|---|---|
| Authentification | jeton signé en HS256, durée de validité de deux heures, sans jeton de rafraîchissement : au-delà, l'utilisateur se reconnecte |
| Stockage du jeton côté client | en mémoire, sans persistance dans le navigateur, afin de limiter l'exposition en cas d'injection de contenu. Un rafraîchissement de page déconnecte, comportement assumé (D57) |
| Mots de passe | hachage bcrypt avec un coût de travail d'au moins 10, jamais de stockage ni de journalisation en clair |
| Réponse à un échec de connexion | message générique, et comparaison effectuée même sur un compte inexistant afin de ne pas créer d'écart de temps de réponse exploitable |
| Contrôle d'accès | trois niveaux : authentification, propriété de la ressource, rôle. Le filtre du propriétaire est porté par la requête de base de données elle-même, jamais par une comparaison effectuée après lecture |
| Ressource appartenant à autrui | code 404 et non 403, afin de ne pas confirmer l'existence d'un identifiant (D52) |
| Injection | requêtes paramétrées exclusivement, à travers un point de passage unique, aucune concaténation |
| Validation des entrées | schéma déclaratif par point d'entrée, rejet des champs inconnus, contraintes de format alignées sur celles de la base |
| Contenu affiché | échappement systématique de tout contenu saisi par l'utilisateur, avec une vigilance particulière sur le champ libre des transactions |
| Secrets | exclusivement dans un fichier d'environnement non versionné, avec un modèle vide et commenté publié. Refus de démarrage si une variable critique manque |
| Origines autorisées | partage de ressources entre origines restreint au domaine de l'interface |

### 5.2 Exactitude des calculs

Exigence structurante du produit, au même rang que la sécurité. Une application patrimoniale qui affiche une plus-value fausse est aussi défaillante qu'une application vulnérable.

- Aucun calcul monétaire ni aucune agrégation de quantité ne repose sur l'arithmétique en virgule flottante.
- Les montants et les quantités sont conservés en base dans un type numérique à précision arbitraire, et manipulés côté serveur en entiers à échelle fixe.
- Les quantités admettent huit décimales, les montants deux.
- Le seul point où une valeur en virgule flottante est acceptée est la lecture d'une réponse de fournisseur externe, immédiatement convertie et arrondie.

### 5.3 Accessibilité

Le référentiel général d'amélioration de l'accessibilité est appliqué dès l'intégration, et non vérifié après coup.

- Contraste d'au moins 4,5:1 entre un texte et son fond, y compris pour le texte secondaire.
- Libellé explicite sur chaque champ de formulaire, message d'erreur associé au champ concerné.
- Navigation au clavier complète, ordre de tabulation cohérent, indicateur de focus visible.
- **Une information n'est jamais portée par la seule couleur.** Une variation de valeur est systématiquement accompagnée d'un signe et d'une flèche. Cette exigence s'applique aussi bien aux maquettes qu'au code.

### 5.4 Résilience et disponibilité

L'application dépend de services externes gratuits, sans engagement de disponibilité. Elle doit se comporter correctement quand ils font défaut.

| Défaillance | Comportement attendu |
|---|---|
| Un fournisseur de cours ne répond pas | le dernier cours connu est renvoyé, explicitement signalé comme tel avec sa date d'origine |
| Aucun cours connu pour un actif | la position est présentée sans valorisation, jamais valorisée à zéro, et le symbole concerné est signalé |
| Le cache est indisponible | l'application démarre et fonctionne, les cours étant demandés directement aux fournisseurs. Le cache est une optimisation, jamais une dépendance dure |
| La base de données est indisponible | le serveur refuse de démarrer avec un message explicite plutôt que de servir des réponses partielles |
| Une variable de configuration critique manque | arrêt immédiat au démarrage, avec la liste complète des variables manquantes |
| L'écriture d'un instantané ou l'évaluation des alertes échoue | l'incident est journalisé et la consultation du portefeuille aboutit malgré tout : ce sont des effets de bord, pas le service rendu |

### 5.5 Performance

*Rubrique volontairement proportionnée au contexte.* CapitAll est destiné à un usage individuel et à une démonstration, non à un service à fort trafic. Aucun test de charge n'est donc exigé. Les engagements retenus sont fonctionnels et vérifiables :

- un rafraîchissement du tableau de bord ne déclenche pas systématiquement d'appel sortant, grâce au cache des cours et à ses durées de vie adaptées à chaque classe d'actif : 120 secondes pour une cryptomonnaie qui cote en continu, 3600 secondes pour une devise dont les taux de référence ne sont publiés qu'une fois par jour ouvré, 600 secondes pour un métal, 300 secondes pour une action (D21) ;
- les cours nécessaires à une consolidation sont demandés en une seule opération groupée, avec déduplication des symboles ;
- l'historique de valorisation est lu depuis les instantanés conservés, jamais reconstitué en interrogeant les fournisseurs pour chaque point de la courbe ;
- aucun traitement de complexité quadratique dans les services métier.

### 5.6 Exploitation et journalisation

- Deux niveaux de journalisation : information pour le démarrage et les événements significatifs, erreur pour les échecs d'authentification, les défaillances de fournisseur et les incidents de cache. Aucun niveau de débogage actif hors développement.
- Aucune donnée personnelle ni aucun secret n'apparaît dans les journaux.
- Les erreurs renvoyées au client ne contiennent jamais de pile d'appels ni de message technique.
- La base est amorçable par un jeu de données de démonstration idempotent, rejouable autant que nécessaire pour repartir d'un état propre.

### 5.7 Compatibilité

- Navigateurs récents fondés sur les moteurs courants, dans leurs deux dernières versions majeures.
- Conception mobile-first, maquettée en 375 pixels de large et déclinée en 1440 pixels.
- Aucune dépendance à une résolution ou à un système d'exploitation particulier.

### 5.8 Protection des données personnelles

Les seules données à caractère personnel collectées sont l'adresse électronique, le pseudonyme et le mot de passe haché. Aucune donnée relevant des catégories particulières du règlement général sur la protection des données n'est collectée.

Les montants et transactions saisis constituent une donnée patrimoniale sensible sur le plan de la confidentialité, sans relever de ces catégories particulières. Ils sont cloisonnés par utilisateur, à tous les niveaux.

Trois principes sont appliqués : minimisation, aucune donnée n'étant collectée sans usage identifié ; cloisonnement, aucun utilisateur ni administrateur n'accédant aux données patrimoniales d'un autre ; effacement en cascade, la suppression d'un compte entraînant celle de l'ensemble de ses données. Aucune conservation d'adresse réseau ni d'identifiant en clair dans les journaux au-delà du strict nécessaire au diagnostic.

## 6. Architecture et choix techniques

Description complète : `conception/architecture.md`. Résumé des choix engageants :

| Brique | Choix | Motif principal |
|---|---|---|
| Interface | React 18 avec Vite | tableau de bord interactif consommant des données au format JSON ; un rendu serveur imposerait un rechargement à chaque changement de période ou de devise d'affichage |
| Serveur | Node.js 20 et Express | architecture en couches explicite, et partage des schémas de validation avec l'interface |
| Base de données | PostgreSQL 16 | type numérique à précision arbitraire indispensable aux montants, et contraintes de vérification riches |
| Cache | Redis 7 | cache court des cours, nécessaire de toute façon, et couvrant un besoin réel de stockage clé-valeur (D14) |
| Authentification | jeton signé et bcrypt | interface sans état, adaptée à un client découplé |
| Validation | schémas déclaratifs | source unique de la forme attendue, réutilisable des deux côtés (D41) |
| Représentation graphique | Recharts (D58) | composants natifs de l'écosystème de l'interface, sans adaptateur à écrire ; un anneau de répartition et une courbe d'aire suffisent au besoin |
| Conteneurisation | Docker et Docker Compose | reproductibilité de l'environnement et démonstration de la procédure de déploiement |

Les cours sont appelés exclusivement côté serveur (D6). Chaque fournisseur est encapsulé dans un adaptateur exposant une interface commune, ce qui permet d'en changer sans toucher à la logique métier (D5).

## 7. Modèle de données

Six entités : `utilisateur`, `actif`, `transaction`, `alerte`, `snapshot_valorisation`, `annonce`. Modèle conceptuel, modèle logique, cardinalités et diagramme : `conception/modele-de-donnees.md`. Script de création : `../backend/db/schema.sql`.

Trois partis pris de modélisation méritent d'être signalés ici, car ils conditionnent le comportement fonctionnel :

- **Aucune valeur dérivée n'est conservée.** Le prix de revient et les plus-values sont recalculés depuis les transactions. Les stocker créerait un risque d'incohérence permanent (D8).
- **L'instantané de valorisation fait exception, volontairement.** Il n'est pas recalculable après coup, faute de conserver les cours passés : c'est un fait historique daté, pas une donnée redondante (D16).
- **Il n'existe pas de référentiel d'actifs partagé.** Chaque utilisateur possède ses propres lignes, ce qui évite une table de correspondance et une gestion de doublons sans bénéfice à cette échelle (D9).

## 8. Interface de programmation

Toutes les routes privées attendent le jeton dans l'en-tête d'autorisation. Une ressource inexistante et une ressource appartenant à un autre utilisateur renvoient toutes deux un code 404 (D52).

| Méthode | Route | Accès | Description | Codes de statut |
|---|---|---|---|---|
| POST | `/api/auth/inscription` | public | création de compte | 201, 400, 409 |
| POST | `/api/auth/connexion` | public | authentification, émission du jeton | 200, 400, 401 |
| GET | `/api/auth/moi` | authentifié | informations du compte courant | 200, 401 |
| GET | `/api/actifs` | authentifié | liste des actifs suivis | 200, 401 |
| POST | `/api/actifs` | authentifié | création d'un actif suivi | 201, 400, 401, 409 |
| GET | `/api/actifs/:id` | propriétaire | détail : transactions, prix de revient, cours, plus-values | 200, 401, 404 |
| PATCH | `/api/actifs/:id` | propriétaire | modification du nom | 200, 400, 401, 404 |
| DELETE | `/api/actifs/:id` | propriétaire | suppression, en cascade sur les transactions et alertes liées | 204, 401, 404 |
| POST | `/api/actifs/:id/transactions` | propriétaire | enregistrement d'une transaction | 201, 400, 401, 404 |
| DELETE | `/api/actifs/:id/transactions/:idTransaction` | propriétaire | suppression d'une transaction | 204, 401, 404 |
| GET | `/api/portefeuille` | authentifié | consolidation : valeur totale, coût de revient, plus-values, répartition, taux de change, alertes franchies | 200, 401 |
| GET | `/api/portefeuille/historique` | authentifié | instantanés de valorisation | 200, 401 |
| GET | `/api/alertes` | authentifié | liste des alertes | 200, 401 |
| POST | `/api/alertes` | authentifié | création d'une alerte | 201, 400, 401, 404 |
| PATCH | `/api/alertes/:id` | propriétaire | désactivation | 200, 400, 401, 404 |
| GET | `/api/annonces` | authentifié | liste des annonces, épinglées en tête | 200, 401 |
| POST | `/api/annonces` | administrateur | publication | 201, 400, 401, 403 |
| PATCH | `/api/annonces/:id` | administrateur | modification ou épinglage | 200, 400, 401, 403, 404 |
| DELETE | `/api/annonces/:id` | administrateur | suppression | 204, 401, 403, 404 |
| GET | `/api/admin/comptes` | administrateur | liste des comptes, sans aucune donnée patrimoniale | 200, 401, 403 |
| PATCH | `/api/admin/comptes/:id` | administrateur | activation ou désactivation d'un compte | 200, 400, 401, 403, 404 |

Les routes d'administration renvoient 403 et non 404 : contrairement au cloisonnement entre utilisateurs, il n'y a ici aucun intérêt à masquer l'existence de la ressource, et un refus explicite est plus clair.

Les structures de données échangées par chaque point d'entrée sont documentées au fil du développement dans une collection d'appels rejouable, versionnée avec le projet.

## 9. Interface utilisateur

### 9.1 Routes de l'application

| Route | Accès | Contenu |
|---|---|---|
| `/connexion` | public | formulaire de connexion |
| `/inscription` | public | formulaire d'inscription |
| `/tableau-de-bord` | authentifié | consolidation, répartition, courbe d'évolution, alertes franchies, annonces |
| `/actifs` | authentifié | liste des actifs suivis |
| `/actifs/:id` | propriétaire | détail d'un actif et de ses transactions |
| `/actifs/:id/transactions/nouvelle` | propriétaire | saisie d'une transaction |
| `/alertes` | authentifié | gestion des alertes |
| `/annonces` | authentifié | fil d'annonces |

Toute route privée atteinte sans jeton valide redirige vers la connexion.

### 9.2 Principes d'interface

Interface sombre et sobre, conçue pour la lecture de chiffres. Direction artistique complète, palette et principes de mise en page : `conception/direction-artistique.md`. Cinq écrans sont maquettés en 375 et en 1440 pixels.

## 10. Contraintes de réalisation

**Gestion de versions.** Deux branches permanentes : une branche stable protégée et une branche d'intégration. Aucun commit direct sur l'une ou l'autre. Une branche par lot fonctionnel cohérent, créée depuis la branche d'intégration, un commit par élément de travail référençant son numéro, et une revue avant fusion (D39, D47). Messages de commit en français, selon la convention documentée dans `convention-commits.md`.

**Tests.** Tests unitaires sur ce qui porte de la logique : validation des entrées, intergiciels, arithmétique, moteur de calcul, adaptateurs, stratégie de cache, évaluation des alertes. Les services métier sont conçus pour être testables sans base de données ni serveur HTTP. Vérifications fonctionnelles de chaque point d'entrée contre une base réellement amorcée, et scénarios de panne explicites pour les exigences de résilience de la section 5.4.

**Déploiement.** Image applicative pour le serveur, image d'interface servie par un serveur web léger, service de base de données et service de cache, orchestrés par un fichier de composition unique. Variables sensibles exclusivement dans un fichier d'environnement non versionné, avec un modèle publié. Une chaîne d'intégration continue n'est pas requise ; l'exécution des tests avant fusion en tient lieu.

## 11. Critères de recette

Le produit est considéré comme conforme si l'ensemble des critères suivants est vérifié.

| # | Critère | Vérification |
|---|---|---|
| C1 | Un utilisateur crée un compte, ajoute des actifs des quatre classes, saisit des transactions et obtient une consolidation exacte | parcours complet sur une base amorcée |
| C2 | Le prix de revient et les plus-values correspondent au centime près à un calcul mené indépendamment | jeu d'essai documenté, confronté au calcul manuel et au test automatisé |
| C3 | Aucun utilisateur n'accède à une donnée d'un autre, y compris en interrogeant directement l'interface de programmation | appels forgés avec le jeton d'un second compte |
| C4 | L'application reste utilisable lorsqu'un fournisseur de cours est indisponible | fournisseur simulé en échec, puis panne réelle constatée |
| C5 | L'application reste utilisable lorsque le cache est arrêté | service de cache stoppé puis redémarré |
| C6 | Les règles de gestion RG1 à RG12 sont toutes vérifiées côté serveur | tests unitaires et appels de contrôle |
| C7 | Les contrastes atteignent le seuil requis et aucune information n'est portée par la seule couleur | mesure par outil dédié, capture à l'appui |
| C8 | L'ensemble se déploie sur une machine vierge à partir du dépôt et de la documentation | installation complète suivie pas à pas |

## 12. Matrice de traçabilité

Correspondance entre les besoins exprimés, les moyens techniques et les compétences du référentiel.

| Besoin | Points d'entrée concernés | Règles associées | Compétences |
|---|---|---|---|
| Disposer d'un espace personnel protégé | inscription, connexion, compte courant | RG1, RG12 | CP5, CP7 |
| Suivre des actifs de classes différentes | actifs | RG2 | CP5, CP6 |
| Enregistrer des mouvements | transactions | RG3, RG4 | CP6, CP7 |
| Connaître son prix de revient et ses plus-values | détail d'actif, portefeuille | RG5, RG6, RG7 | CP7 |
| Obtenir des cours à jour sans ressaisie | service de cours et cache | aucune | CP6, CP7 |
| Consulter une vue consolidée | portefeuille | RG5 | CP4, CP7 |
| Suivre l'évolution dans le temps | historique | RG8 | CP5, CP7 |
| Être averti au franchissement d'un seuil | alertes | RG9, RG10, RG11 | CP7 |
| Être informé des évolutions du service | annonces | aucune | CP3, CP7 |
| Administrer le service sans accéder aux données patrimoniales | administration | RG1, RG12 | CP7 |
| Consulter depuis un mobile | interface complète | aucune | CP2, CP3, CP4 |
| Installer et redéployer l'application | composition de services et documentation | aucune | CP1, CP8 |

## 13. Glossaire

| Terme | Définition |
|---|---|
| **Prix de revient unitaire moyen pondéré** | coût moyen d'une unité détenue, frais d'achat inclus, recalculé à chaque achat au prorata des quantités |
| **Plus-value latente** | gain ou perte théorique sur la quantité encore détenue, au cours du moment. Elle n'est pas encaissée |
| **Plus-value réalisée** | gain ou perte effectivement constaté lors d'une vente, calculé au prix de revient en vigueur à cette date, frais de vente déduits |
| **Instantané de valorisation** | photographie de la valeur totale du portefeuille à une date donnée, conservée parce qu'elle n'est pas reconstituable après coup |
| **Adaptateur** | module encapsulant un fournisseur externe derrière une interface commune, afin que la logique métier ignore son identité |
| **Durée de vie du cache** | délai au-delà duquel une valeur mise en cache est considérée comme périmée et redemandée à sa source |
| **Liste blanche** | ensemble fermé de valeurs autorisées, ici les symboles d'actions suivables, contrôlé côté serveur |
| **Cloisonnement** | garantie qu'un utilisateur ne peut accéder qu'à ses propres données, appliquée au niveau des requêtes de base de données |

## 14. Documents de référence

| Document | Contenu |
|---|---|
| `note-de-cadrage.md` | contexte, objectifs, périmètre initial |
| `conception/cas-utilisation.md` | acteurs et cas d'utilisation, diagramme |
| `conception/modele-de-donnees.md` | modèle conceptuel, logique et physique |
| `conception/architecture.md` | architecture applicative, flux, adaptateurs |
| `conception/direction-artistique.md` | palette, typographie, principes de mise en page, écrans |
| `convention-commits.md` | convention de messages et flux de contribution |
| `planning.md` | calendrier, jalons, gel du code |
| `jeu-essai-calculs.md` | jeu d'essai détaillé du calcul du prix de revient et des plus-values |
