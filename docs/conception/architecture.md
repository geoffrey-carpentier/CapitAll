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
        |                        - FmpAdapter         (actions, principal)
        |                        - FinnhubAdapter     (actions, secours 1)
        |                        - AlphaVantageAdapter (actions, secours 2 + historique)
        |                                          |
        |                                          v
        |                              [ Redis - cache cours ]
        |                              clé cours:{type}:{symbole}, TTL par classe
        v
[ PostgreSQL ]
  utilisateur / actif / transaction / alerte / snapshot_valorisation / annonce
```

## Justification des choix

**Pourquoi le serveur appelle les API de cours, et pas le navigateur ?**

- point de passage unique : mise en cache des cours côté serveur (TTL court) pour limiter les appels sortants et lisser les indisponibilités des fournisseurs
- le front consomme un format unifié quel que soit le fournisseur, la logique d'adaptation reste au même endroit que le calcul de plus-value qui en dépend
- pas de problème de CORS avec les API tierces, et si un fournisseur exige un jour une clé (extension bourse), elle reste secrète côté serveur

**Cache des cours en Redis (D14, D21)**

Le cache court côté serveur est implémenté avec Redis plutôt qu'avec une structure en mémoire du process Node. Le service de cours interroge d'abord Redis (clé `cours:{type}:{symbole}`) avant d'appeler l'adaptateur correspondant ; en cas d'échec de l'adaptateur, le dernier cours connu en cache est renvoyé avec son horodatage plutôt qu'une erreur, conformément à la règle déjà décrite dans cas-utilisation.md. Les durées de vie sont différenciées selon le rythme réel de chaque source (D21) : crypto 60-120 s, action 300 s, métal 300-600 s, devise 3600 s (les taux BCE de Frankfurter ne changent qu'une fois par jour ouvré). Ce choix, au-delà du bénéfice technique (résilience face aux indisponibilités et aux quotas des fournisseurs), constitue le composant NoSQL du projet : une structure clé-valeur, à durée de vie courte, sans schéma relationnel, qui n'a pas vocation à être portée par PostgreSQL.

**Adaptateurs actions et conversion de devise (D20, D26, D27)**

Les actions sont servies par FmpAdapter en principal, avec une chaîne de secours à deux niveaux : FinnhubAdapter puis AlphaVantageAdapter. Le périmètre est fermé par une liste blanche d'environ 85 valeurs américaines (celles accessibles sur le plan gratuit FMP), contrôlée côté serveur avant tout appel réseau : un symbole hors liste est refusé sans consommer de quota. Il n'y a pas de recherche libre de symboles.

FMP a été retenu en principal parce qu'un seul appel `/stable/quote` fournit à la fois le cours et les données de la fiche enrichie (capitalisation, fourchette 52 semaines, moyennes 50/200 jours), là où Finnhub imposerait un second appel pour moins d'informations. Contrepartie assumée : son quota est journalier (250/jour) quand celui de Finnhub se régénère chaque minute. Le cache Redis et la taille bornée de la liste suivie rendent cette contrainte acceptable, et la bascule vers Finnhub reste immédiate puisque les deux adaptateurs exposent la même interface.

Ces fournisseurs cotent en USD ; l'adaptateur convertit en euros via le taux EUR/USD de Frankfurter déjà présent en cache, ce qui fait de l'adaptateur actions une composition de deux sources. Les clés d'API résident exclusivement dans `.env`, jamais dans le code ni le dépôt.

Particularité d'Alpha Vantage à gérer : ses erreurs (quota, symbole inconnu) arrivent en HTTP 200 avec un champ `Information` ou un objet vide. L'adaptateur valide donc la présence et la forme des champs attendus, et non le seul code HTTP. La même prudence s'applique à Finnhub, qui renvoie `c: 0` sur un symbole inconnu.

**Découpage en couches côté serveur**

- routes : déclaration des endpoints, branchement des middlewares
- middlewares : vérification du JWT, validation des entrées
- controllers : lecture de la requête, code de statut, format de réponse
- services : logique métier (PRU moyen pondéré, plus-value latente et réalisée, consolidation du portefeuille)
- models : accès à PostgreSQL, requêtes préparées exclusivement

Ce découpage isole la logique métier, qui devient testable unitairement sans base ni HTTP.

**Adaptateurs de cours**

Chaque fournisseur implémente la même interface : `getCours(symbole) -> { symbole, cours_eur, horodatage }`. Ajouter la bourse plus tard (Finnhub ou Alpha Vantage) revient à écrire un adaptateur supplémentaire, sans toucher aux services ni au front.

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

**Bascule d'affichage euro/dollar (D43)** : le tableau de bord peut présenter les montants en euro ou en dollar. La devise de référence de calcul et de stockage reste l'euro ; la bascule est une simple conversion à l'affichage, appliquée au taux EUR/USD de Frankfurter déjà présent en cache pour les actions, sans appel supplémentaire. Aucun montant en dollar n'est stocké, aucun PRU n'est recalculé par devise ; les snapshots restent enregistrés en euro et sont convertis au taux courant à la lecture. Le multi-devise de référence complet reste hors périmètre.

**Annonces et autorisation par rôle (D22, D23)** : les annonces internes sont publiées par l'admin via un CRUD protégé par un middleware de rôle, troisième niveau de contrôle d'accès après l'authentification (JWT valide) et la propriété (la ressource appartient au demandeur). Le rôle admin est à moindre privilège strict : il ne donne jamais accès aux portefeuilles, transactions ou alertes d'autrui ; le champ `role` n'est accepté dans aucune entrée utilisateur (assignation par seed ou SQL direct uniquement).

**Fil d'actualités externes (D24, option de semaine 4)** : si réalisé, agrégation côté serveur de 2-3 flux RSS publics, stockée en cache Redis avec un TTL de l'ordre de 15-30 minutes, exposée par un endpoint de lecture simple. Aucune persistance PostgreSQL, aucune clé d'API.
