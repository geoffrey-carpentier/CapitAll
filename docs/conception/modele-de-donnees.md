# Modèle de données - CapitAll

## Modèle conceptuel de données (MCD, formalisme Merise)

Sept entités couvrent le périmètre du MVP. Les trois premières (utilisateur, actif, transaction) forment le socle initial. Deux entités complémentaires ont été ajoutées le 14/07/2026 (D15, D16) pour les alertes de seuil et l'historique de valorisation, puis une sixième le 16/07/2026 (D22) pour les annonces internes publiées par l'administrateur. La même date, le type d'actif `action` a été ajouté (D20, réintégration de la bourse au MVP) et la colonne `role` sur l'utilisateur (D23). Le 06/08/2026, la colonne `actif` a complété l'utilisateur (D60), le modèle ne permettant jusque-là pas de représenter la désactivation d'un compte que le rôle d'administration prévoit pourtant de déclencher. Le 23/08/2026, une septième entité a été ajoutée (D81) : l'historique de cours par position, sans lequel ni le graphe de cours de l'écran de détail ni la tendance sur trente jours du tableau des positions n'étaient alimentables.

### Entités

**UTILISATEUR**
- id_utilisateur (identifiant)
- email
- mot_de_passe (haché, jamais stocké en clair)
- pseudo
- role (utilisateur / admin)
- actif (le compte est-il utilisable)
- date_inscription

**ACTIF**
- id_actif (identifiant)
- type (crypto / devise / metal / action)
- symbole (ex. BTC, USD, XAU, AAPL)
- nom (ex. Bitcoin, Dollar américain, Or, Apple)
- date_ajout

**TRANSACTION**
- id_transaction (identifiant)
- sens (achat / vente)
- quantite
- prix_unitaire (en euros, devise de référence du MVP)
- frais
- date_transaction
- note

**ALERTE**
- id_alerte (identifiant)
- type_cible (actif / capital_total)
- sens_seuil (au-dessus / en-dessous)
- valeur_seuil
- statut (active / declenchee / desactivee)
- date_creation
- date_declenchement (renseignée seulement au déclenchement)

**SNAPSHOT_VALORISATION**
- id_snapshot (identifiant)
- date_snapshot
- valeur_totale_eur

**SNAPSHOT_COURS**
- id_snapshot_cours (identifiant)
- date_snapshot
- cours_eur (cours unitaire du jour, en euros)
- quantite (quantité détenue ce jour-là)

**ANNONCE**
- id_annonce (identifiant)
- titre
- contenu
- epinglee (oui / non)
- date_publication

### Associations et cardinalités

```
UTILISATEUR (1,n) --- POSSÉDER ------ (1,1) ACTIF
ACTIF       (1,n) --- COMPORTER ----- (1,1) TRANSACTION
UTILISATEUR (1,n) --- DEFINIR ------- (1,1) ALERTE
ACTIF       (0,n) --- CONCERNER ----- (0,1) ALERTE
UTILISATEUR (1,n) --- ENREGISTRER --- (1,1) SNAPSHOT_VALORISATION
ACTIF       (1,n) --- RELEVER ------- (1,1) SNAPSHOT_COURS
UTILISATEUR (0,n) --- PUBLIER ------- (1,1) ANNONCE
```

Lecture : un utilisateur possède un ou plusieurs actifs suivis ; un actif appartient à un et un seul utilisateur. Un actif comporte une ou plusieurs transactions ; une transaction porte sur un et un seul actif. Un utilisateur définit une ou plusieurs alertes ; une alerte appartient à un et un seul utilisateur. Une alerte concerne éventuellement un actif précis (type_cible = actif) ou aucun (type_cible = capital_total, portant alors sur l'ensemble du portefeuille) ; un actif peut être la cible de zéro, une ou plusieurs alertes. Un utilisateur enregistre un ou plusieurs snapshots de valorisation ; un snapshot appartient à un et un seul utilisateur. Un actif fait l'objet d'un ou plusieurs relevés de cours ; un relevé porte sur un et un seul actif, et son propriétaire se lit par cet actif, jamais par une colonne qui lui serait propre. Un utilisateur publie zéro ou plusieurs annonces ; une annonce est publiée par un et un seul utilisateur, la restriction « seul un admin publie » étant une règle de gestion portée par le rôle, vérifiée côté serveur, pas par la structure du modèle.

Choix de conception discutés :

- Le cours courant n'est pas une entité : il est volatil, fourni par les API externes à la demande, et le persister n'apporte rien au MVP. Sa volatilité est en revanche traitée par un cache technique (Redis, hors du modèle relationnel, voir architecture.md et D14), pas par une entité SQL.
- Le PRU et la plus-value ne sont pas stockés : ce sont des valeurs calculées à partir des transactions, les stocker créerait un risque d'incohérence (D8).
- Un référentiel d'actifs partagé entre utilisateurs (table de symboles commune) a été envisagé puis écarté : il complexifie le modèle sans bénéfice au MVP, chaque utilisateur déclare simplement les symboles qu'il suit (D9).
- SNAPSHOT_VALORISATION déroge en apparence à la règle « pas de valeur dérivée stockée » : la dérogation est volontaire (D16). Une valeur de portefeuille à une date passée n'est pas recalculable après coup dès lors que les cours historiques des fournisseurs ne sont pas conservés côté CapitAll ; un snapshot est donc un fait historique à part entière, pas une donnée redondante avec les transactions. Il sert aussi à éviter de rappeler les API de cours pour reconstituer une courbe d'évolution.
- SNAPSHOT_COURS déroge à la même règle et pour la même raison que SNAPSHOT_VALORISATION (D81). Un cours passé ne se recalcule pas : les fournisseurs ne conservent pas leur historique de la même façon selon la classe d'actif, et l'un d'eux n'en expose aucun. Ce que l'application n'a pas relevé le jour même est perdu, ce qui fait de chaque ligne un fait daté. La quantité détenue y est jointe au cours, faute de quoi reconstituer la valeur passée d'une position obligerait à rejouer toutes ses transactions antérieures à chaque point de la courbe.
- SNAPSHOT_COURS ne porte pas d'`utilisateur_id`, alors que SNAPSHOT_VALORISATION en porte un. La différence n'est pas une inconséquence : un snapshot de valorisation porte sur le portefeuille entier, dont l'utilisateur est la seule clé possible, tandis qu'un relevé de cours porte sur un actif, qui connaît déjà son propriétaire. Dupliquer l'information créerait une seconde vérité sur le cloisonnement, avec la certitude qu'elles divergent un jour ; le cloisonnement se lit donc par jointure, comme pour TRANSACTION.
- ALERTE ne référence pas systématiquement un actif : `actif_id` est nul lorsque l'alerte porte sur le capital total du portefeuille plutôt que sur un actif précis. Contrairement à la règle « quantité vendue disponible » qui nécessite une agrégation sur plusieurs lignes de transaction et reste donc du ressort du serveur, la cohérence entre `type_cible` et la présence de `actif_id` ne porte que sur des colonnes de la même ligne : elle est directement portée par une contrainte CHECK au niveau du MPD.

## Modèle logique de données (MLD)

Notation relationnelle, clés primaires soulignées par convention # , clés étrangères préfixées par -> :

```
utilisateur (#id, email UNIQUE NOT NULL, mot_de_passe_hache NOT NULL,
             pseudo NOT NULL, role NOT NULL DEFAULT 'utilisateur',
             actif NOT NULL DEFAULT true, date_inscription NOT NULL)

actif (#id, ->utilisateur_id NOT NULL, type NOT NULL, symbole NOT NULL,
       nom NOT NULL, date_ajout NOT NULL,
       UNIQUE(utilisateur_id, symbole))

transaction (#id, ->actif_id NOT NULL, sens NOT NULL, quantite NOT NULL,
             prix_unitaire NOT NULL, frais NOT NULL DEFAULT 0,
             date_transaction NOT NULL, note)

alerte (#id, ->utilisateur_id NOT NULL, ->actif_id NULL, type_cible NOT NULL,
        sens_seuil NOT NULL, valeur_seuil NOT NULL, statut NOT NULL DEFAULT 'active',
        date_creation NOT NULL, date_declenchement)

snapshot_valorisation (#id, ->utilisateur_id NOT NULL, date_snapshot NOT NULL,
                        valeur_totale_eur NOT NULL,
                        UNIQUE(utilisateur_id, date_snapshot))

snapshot_cours (#id, ->actif_id NOT NULL, date_snapshot NOT NULL,
                cours_eur NOT NULL, quantite NOT NULL,
                UNIQUE(actif_id, date_snapshot))

annonce (#id, ->auteur_id NOT NULL, titre NOT NULL, contenu NOT NULL,
         epinglee NOT NULL DEFAULT false, date_publication NOT NULL)
```

Contraintes de domaine prévues pour le MPD (PostgreSQL) :

- `type` restreint à ('crypto', 'devise', 'metal', 'action') par contrainte CHECK
- `role` restreint à ('utilisateur', 'admin') par contrainte CHECK, défaut 'utilisateur'
- `actif` booléen non nul, défaut `true` : un compte est utilisable dès sa création
- `sens` restreint à ('achat', 'vente') par contrainte CHECK
- `type_cible` restreint à ('actif', 'capital_total') par contrainte CHECK
- `sens_seuil` restreint à ('au_dessus', 'en_dessous') par contrainte CHECK
- `statut` de l'alerte restreint à ('active', 'declenchee', 'desactivee') par contrainte CHECK
- `quantite > 0`, `prix_unitaire >= 0`, `frais >= 0`, `valeur_seuil > 0`, `valeur_totale_eur >= 0`
- sur `snapshot_cours` : `cours_eur >= 0` et `quantite >= 0`, la quantité pouvant valoir zéro avant le premier achat de l'actif
- montants et quantités en `NUMERIC` (pas de flottant sur des valeurs financières)
- suppression en cascade des transactions à la suppression d'un actif (`ON DELETE CASCADE`), suppression d'un utilisateur en cascade sur ses actifs, ses alertes, ses snapshots et ses annonces
- suppression d'un actif en cascade sur les alertes qui le ciblent et sur ses relevés de cours (`ON DELETE CASCADE` sur alerte.actif_id et snapshot_cours.actif_id) ; la suppression d'un compte atteint donc ces relevés en deux sauts, par ses actifs
- la règle « quantité vendue disponible » (on ne vend pas plus que ce que l'on détient) porte sur l'agrégation de plusieurs transactions : elle est vérifiée côté serveur, pas par une contrainte SQL
- la cohérence entre `type_cible` et la présence de `actif_id` (actif_id renseigné si et seulement si type_cible = 'actif') ne porte que sur la même ligne : elle est portée par une contrainte CHECK au niveau du MPD

Le MPD (script SQL complet avec index) sera produit en phase back-end, il découle directement de ce MLD.

## Diagramme entité-association (source Mermaid)

```mermaid
erDiagram
    UTILISATEUR ||--o{ ACTIF : possede
    ACTIF ||--o{ TRANSACTION : comporte
    UTILISATEUR ||--o{ ALERTE : definit
    ACTIF |o--o{ ALERTE : concerne
    UTILISATEUR ||--o{ SNAPSHOT_VALORISATION : enregistre
    ACTIF ||--o{ SNAPSHOT_COURS : releve
    UTILISATEUR ||--o{ ANNONCE : publie

    UTILISATEUR {
        int id PK
        string email UK
        string mot_de_passe_hache
        string pseudo
        string role
        boolean actif
        timestamp date_inscription
    }
    ACTIF {
        int id PK
        int utilisateur_id FK
        string type
        string symbole
        string nom
        timestamp date_ajout
    }
    TRANSACTION {
        int id PK
        int actif_id FK
        string sens
        numeric quantite
        numeric prix_unitaire
        numeric frais
        date date_transaction
        string note
    }
    ALERTE {
        int id PK
        int utilisateur_id FK
        int actif_id FK
        string type_cible
        string sens_seuil
        numeric valeur_seuil
        string statut
        timestamp date_creation
        timestamp date_declenchement
    }
    SNAPSHOT_VALORISATION {
        int id PK
        int utilisateur_id FK
        date date_snapshot
        numeric valeur_totale_eur
    }
    SNAPSHOT_COURS {
        int id PK
        int actif_id FK
        date date_snapshot
        numeric cours_eur
        numeric quantite
    }
    ANNONCE {
        int id PK
        int auteur_id FK
        string titre
        string contenu
        boolean epinglee
        timestamp date_publication
    }
```
