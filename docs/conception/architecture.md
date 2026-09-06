# Architecture générale - CapitAll

## Vue d'ensemble

Architecture front / back séparée. Le client React ne parle qu'à l'API Express ; seul le serveur interroge les fournisseurs de cours externes.

```
[ Navigateur ]
  React + Vite (SPA mobile-first)
        |
        |  HTTPS - JSON - JWT dans l'en-tête Authorization
        v
[ Serveur Node.js / Express ]
  routes -> middlewares (auth, validation) -> controllers -> services -> models
        |                                          |
        |                                          v
        |                              [ Service de cours ]
        |                        adaptateurs interchangeables :
        |                        - CoinbaseAdapter    (crypto)
        |                        - FrankfurterAdapter (devises)
        |                        - GoldApiAdapter     (métaux)
        |                        - ActionsAdapter     (FMP -> Finnhub -> Alpha Vantage)
        |                                          |
        |                                          v
        |                              [ Redis - cache cours ]
        |                              cours:{symbole} + dernier connu, TTL par classe
        v
[ PostgreSQL ]
  utilisateur / actif / transaction / alerte / snapshot_valorisation /
  snapshot_cours / annonce
```

## Justification des choix

**Pourquoi le serveur appelle les API de cours, et pas le navigateur ?**

- point de passage unique : mise en cache des cours côté serveur (TTL court) pour limiter les appels sortants et lisser les indisponibilités des fournisseurs
- le front consomme un format unifié quel que soit le fournisseur, la logique d'adaptation reste au même endroit que le calcul de plus-value qui en dépend
- pas de problème de CORS avec les API tierces, et si un fournisseur exige un jour une clé (extension bourse), elle reste secrète côté serveur

**Cache des cours en Redis (D14, D21)**

Le cache court côté serveur est implémenté avec Redis plutôt qu'avec une structure en
mémoire du processus Node. Le service lit d'abord `cours:v2:{classe}:{SYMBOLE}` ; un cours
frais y vit 120 secondes pour une cryptomonnaie, 3600 pour une devise, 600 pour un métal
et 300 pour une action. Après un appel réussi, il écrit aussi
`cours:v2:dernier-connu:{classe}:{SYMBOLE}`, sans expiration. La classe fait partie de la
clé : un même symbole peut désigner une cryptomonnaie et une devise, et les confondre
rendait le cours de l'une pour une demande portant sur l'autre. Le préfixe est versionné
pour que les entrées écrites sous l'ancien format ne soient jamais relues. Si le fournisseur échoue, cette
seconde clé permet de rendre la dernière valeur connue avec son horodatage. Redis reste
une optimisation : son indisponibilité n'empêche pas l'appel direct aux fournisseurs.

**Adaptateurs actions et conversion de devise (D20, D26, D27)**

Les actions sont servies par un adaptateur unique qui essaie FMP en principal, puis
Finnhub et Alpha Vantage. Le périmètre est fermé par une liste blanche d'environ 85
valeurs américaines, contrôlée côté serveur avant tout appel réseau : un symbole hors
liste est refusé sans consommer de quota. Il n'y a pas de recherche libre de symboles.

Le MVP exploite le cours courant de `/stable/quote`. Les données enrichies envisagées en
D27 — capitalisation, fourchette annuelle, moyennes et secteur — ne sont pas exposées
par le contrat actuel et restent une évolution. Ce bornage évite d'annoncer une fiche
qui n'existe pas dans l'interface tout en livrant la valorisation des actions.

Ces fournisseurs cotent en USD ; l'adaptateur convertit en euros via le taux EUR/USD de Frankfurter déjà présent en cache, ce qui fait de l'adaptateur actions une composition de deux sources. Les clés d'API résident exclusivement dans `.env`, jamais dans le code ni le dépôt.

Particularité d'Alpha Vantage à gérer : ses erreurs (quota, symbole inconnu) arrivent en HTTP 200 avec un champ `Information` ou un objet vide. L'adaptateur valide donc la présence et la forme des champs attendus, et non le seul code HTTP. La même prudence s'applique à Finnhub, qui renvoie `c: 0` sur un symbole inconnu.

**Répartition du calcul entre le serveur et l'interface**

Règle opposable, applicable à tout arbitrage futur.

Toute donnée représentant un **état métier** est calculée par le serveur : prix de revient, plus-values latente et réalisée, performances globales et par période, répartitions, franchissements de seuil, agrégats. Le serveur en est le propriétaire unique. Si une formule évolue, elle change à un seul endroit et se teste à un seul endroit.

L'interface ne réalise que des **transformations de présentation** : conversion d'unité ou de devise à un taux fourni par le serveur, formatage, adaptation à la locale, arrondi d'affichage. Elle ne calcule jamais une règle métier.

*Critère de tri en cas de doute.* Si le serveur aurait besoin de cette valeur pour répondre à une question, c'est du métier. Si elle n'existe que pour être lue par un être humain, c'est de la présentation. Une transformation de présentation n'ajoute aucune information et ne crée aucun fait que le domaine devrait conserver.

*Cas limite tranché : la conversion euro/dollar.* Multiplier un montant par un taux est bien de l'arithmétique sur une valeur monétaire, mais le résultat n'est pas un fait nouveau : le patrimoine vaut ce qu'il vaut en euro, et la valeur en dollar n'est qu'un rendu du même fait dans une autre unité. La devise de référence reste l'euro, aucune valeur en dollar n'est stockée ni calculée par le domaine. C'est donc une transformation de présentation, et c'est la seule opération arithmétique que l'interface réalise.

*Le taux appliqué est celui de la réponse courante*, livré par `GET /api/portefeuille` avec son horodatage. Il n'est jamais récupéré séparément ni rafraîchi par minuterie : un écran affiche toujours un seul taux, sans quoi un total pourrait cesser d'être égal à la somme de ses parties.

*Non-divergence des arrondis.* La multiplication existe des deux côtés, dans `backend/src/utils/decimal.js` pour le domaine et dans l'interface pour l'affichage. La règle d'arrondi — au plus proche, les demis s'écartant de zéro — est vérifiée par un jeu d'essai partagé, `fixtures/conversion-affichage.json`, que les deux suites de tests consomment et sur lequel elles doivent rendre exactement les mêmes chaînes.

**Découpage en couches côté serveur**

- routes : déclaration des endpoints, branchement des middlewares
- middlewares : vérification du JWT, validation des entrées
- controllers : lecture de la requête, code de statut, format de réponse
- services : logique métier (PRU moyen pondéré, plus-value latente et réalisée, consolidation du portefeuille)
- models : accès à PostgreSQL, requêtes préparées exclusivement

Ce découpage isole la logique métier, qui devient testable unitairement sans base ni HTTP.

**Adaptateurs de cours**

Chaque classe expose la même interface :
`getCours(symbole) -> { symbole, cours_eur, horodatage }`. Pour les actions, l'ordre des
fournisseurs est encapsulé dans l'adaptateur et reste invisible au service métier.

## Flux type : affichage du tableau de bord

1. le client envoie `GET /api/portefeuille` avec son JWT
2. le middleware d'authentification vérifie le token et attache l'identifiant utilisateur à la requête
3. le service portefeuille charge les actifs et transactions de cet utilisateur uniquement
4. pour chaque actif, le service de cours renvoie le cours courant (Redis ou appel au fournisseur si absent du cache)
5. le service calcule PRU, plus-value latente et réalisée par actif et valeur totale
6. le controller renvoie le JSON consolidé, le front l'affiche (répartition + évolution)

## Flux complémentaires

**Évaluation des alertes** : à chaque consultation du tableau de bord, après le calcul de la valeur du portefeuille et des plus-values par actif, le service d'alertes compare les alertes actives de l'utilisateur (statut = active) aux valeurs courantes (cours d'un actif ou capital total) ; toute alerte franchie passe au statut declenchee et est signalée au front. Aucune tâche planifiée en tâche de fond dans la version MVP : l'évaluation reste liée au chargement du tableau de bord (version light retenue).

**Alimentation de l'historique de valorisation** : à la première consultation du tableau de bord d'une journée donnée, si aucun snapshot n'existe encore pour ce jour, le service de portefeuille enregistre un snapshot_valorisation avec la valeur totale calculée. La courbe d'évolution du tableau de bord se construit ensuite par simple lecture des snapshots existants, sans rappeler les API de cours pour les jours passés.

**Alimentation de l'historique de cours par position** : au même point d'appel et par le même déclencheur, le service enregistre pour chaque position valorisée son cours du jour et la quantité détenue dans snapshot_cours. Aucune tâche planifiée n'est introduite : les positions valorisées sont déjà disponibles à cet endroit, l'écriture s'y ajoute. Une position dont le cours n'a pas pu être obtenu est écartée plutôt qu'enregistrée à zéro, pour la même raison qu'un portefeuille entièrement sans cours n'est pas historisé — un trou dans la courbe est préférable à un point faux. Cet historique alimente le graphe de cours de l'écran de détail et la tendance sur trente jours du tableau des positions.

**Bascule d'affichage euro/dollar (D43)** : le tableau de bord peut présenter les montants en euro ou en dollar. La devise de référence de calcul et de stockage reste l'euro ; la bascule est une simple conversion à l'affichage, appliquée au taux EUR/USD de Frankfurter déjà présent en cache pour les actions, sans appel supplémentaire. Aucun montant en dollar n'est stocké, aucun PRU n'est recalculé par devise ; les snapshots restent enregistrés en euro et sont convertis au taux courant à la lecture. Le multi-devise de référence complet reste hors périmètre.

**Annonces et administration** : la table `annonce`, le rôle `admin` et le middleware de
rôle existent dans le socle, mais aucune route ni interface d'administration n'est
montée dans le MVP. La publication d'annonces et la gestion des comptes sont reportées
en version 2. Le champ `role` reste refusé dans toutes les entrées utilisateur.

**Fil d'actualités externes** : abandonné pour le MVP. Il n'existe ni endpoint RSS ni
composant d'interface correspondant.
