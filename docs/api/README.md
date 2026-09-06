# API CapitAll — référence minimale

Cette référence décrit les routes réellement montées dans `backend/src/app.js`. Elle
accompagne la collection exécutable `capitall.http`. L'API échange du JSON, sauf
l'export CSV. Toutes les routes protégées attendent l'en-tête :

```http
Authorization: Bearer <token>
```

Le jeton est obtenu par `POST /api/auth/connexion`. Il ne doit jamais être enregistré
dans Git. Les erreurs JSON ont la forme `{ "erreur": "message" }` et peuvent ajouter
`champs` pour les erreurs de validation. Les statuts usuels sont `400`, `401`, `404`,
`409`, `503` et `500`.

## Routes publiques

| Méthode | Route | Corps / résultat principal |
| --- | --- | --- |
| GET | `/api/sante` | `200` — `{ "statut": "ok" }` |
| POST | `/api/auth/inscription` | `{ email, motDePasse, pseudo? }` → `201` profil sans mot de passe |
| POST | `/api/auth/connexion` | `{ email, motDePasse }` → `200` avec `token` et utilisateur |

## Routes protégées

| Méthode | Route | Corps / résultat principal |
| --- | --- | --- |
| GET | `/api/auth/moi` | profil du porteur du jeton |
| GET | `/api/actifs` | actifs appartenant au porteur du jeton |
| POST | `/api/actifs` | `{ type, symbole, nom }` → `201`; types : `crypto`, `devise`, `metal`, `action` |
| GET | `/api/actifs/:id` | position, cours, historique et mouvements de l'actif possédé |
| PATCH | `/api/actifs/:id` | `{ nom }` |
| DELETE | `/api/actifs/:id` | `204`; suppression en cascade de ses données liées |
| POST | `/api/actifs/:id/transactions` | mouvement → `201`; refuse toute sortie rendant le solde négatif à sa date |
| POST | `/api/actifs/:id/transactions/simulation` | même corps, calcul sans écriture → `200` |
| PATCH | `/api/actifs/:id/transactions/:idTransaction` | correction d'un mouvement → `200`; refuse celle qui rendrait l'historique invalide |
| POST | `/api/actifs/:id/transactions/:idTransaction/simulation` | effet de la correction, sans écriture → `200` |
| DELETE | `/api/actifs/:id/transactions/:idTransaction` | `204`; refuse une suppression qui rendrait l'historique invalide |
| GET | `/api/portefeuille` | portefeuille consolidé, cours, performances, alertes déclenchées |
| GET | `/api/portefeuille/historique?jours=30` | historique; `jours` facultatif, entier de 1 à 3650 |
| GET | `/api/alertes` | alertes du porteur du jeton |
| POST | `/api/alertes` | `{ type_cible, sens_seuil, valeur_seuil, actif_id? }` → `201` |
| PATCH | `/api/alertes/:id` | `{ "statut": "desactivee" }` |
| PATCH | `/api/compte/mot-de-passe` | `{ ancienMotDePasse, nouveauMotDePasse }` → `200 { token }` |
| GET | `/api/compte/export-mouvements` | CSV UTF-8 avec `Content-Disposition` |
| GET | `/api/symboles` | couverture des symboles par classe, avec provenance et date |
| POST | `/api/auth/mot-de-passe-oublie` | `{ email }` → `202`, réponse identique que l'adresse existe ou non |
| POST | `/api/auth/reinitialisation` | `{ jeton, nouveauMotDePasse }` → `204` |
| DELETE | `/api/compte` | `{ motDePasse }` → `204`; suppression définitive du compte |

Le corps d'un mouvement est :

```json
{
  "sens": "achat",
  "quantite": "0.25",
  "prix_unitaire": "50000.00",
  "frais": "2.50",
  "date_transaction": "2026-08-31T08:00:00.000Z",
  "note": "facultative"
}
```

`sens` vaut `achat`, `vente` ou `sortie_non_marchande`. Une sortie non marchande — un
transfert ou un retrait — n'accepte pas de `prix_unitaire` : elle ne dégage aucun
produit.

Les frais se donnent sous **une seule** des trois formes, jamais deux à la fois :

| Forme | Champs | Contre-valeur en euros |
|---|---|---|
| en euros | `frais` | le montant lui-même |
| dans l'actif de l'opération | `frais_montant`, `frais_unite` égal au symbole de l'actif | calculée au `prix_unitaire` du mouvement |
| dans un autre actif | `frais_montant`, `frais_unite`, `frais_contre_valeur_eur` | celle qui est fournie ; son absence est refusée en `400` |

```json
{
  "sens": "achat",
  "quantite": "0.398",
  "prix_unitaire": "2500",
  "frais_montant": "0.002",
  "frais_unite": "ETH",
  "date_transaction": "2026-08-31T08:00:00.000Z"
}
```

Envoyer `frais` et `frais_montant` ensemble est refusé en `400` : les deux formes se
contredisent dès que l'unité n'est pas l'euro, et rien ne dirait laquelle prime.

## Corriger un mouvement

`PATCH /api/actifs/:id/transactions/:idTransaction` prend le même corps qu'une création
et rend le mouvement corrigé. PATCH et non PUT : le corps ne porte que les champs
modifiables, jamais la représentation complète de la ressource — ni son identifiant, ni
son actif, ni les valeurs que le moteur en dérive.

L'actif n'est pas modifiable : un mouvement appartient à l'histoire d'une position, et
l'en détacher laisserait celle-ci avec un prix de revient calculé sur un mouvement
qu'elle n'a plus.

La correction est refusée en `400` si elle rendait un mouvement postérieur impossible —
réduire un achat sous une vente qui en dépend, par exemple. Le refus précède toute
écriture, et l'ensemble est enveloppé dans une transaction PostgreSQL avec verrou sur
l'actif : deux corrections concurrentes se sérialisent, et la seconde décide sur
l'historique que la première a laissé.

`POST /api/actifs/:id/transactions/:idTransaction/simulation` rend l'effet de cette
correction sans rien écrire. La position « avant » est celle d'aujourd'hui : l'écart
annoncé est donc bien ce que la correction change.

## Couverture des symboles

`GET /api/symboles` décrit ce que l'application accepte, classe par classe. Deux classes
ont une liste énumérable, deux n'en ont pas : Coinbase cote des milliers de paires et
Frankfurter suit les taux de référence de la Banque centrale européenne, deux ensembles
qui changent sans prévenir.

| Champ | Sens |
|---|---|
| `couverture` | `fermee` si la liste est connue d'avance, `ouverte` sinon |
| `provenance` | le fournisseur ou la source de la liste |
| `constate_le` | la date à laquelle elle a été vérifiée |
| `controle` | `à la saisie` ou `au premier relevé de cours` |
| `symboles` | présent seulement sur une couverture fermée |

Seule la liste des actions est **opposable** : un symbole absent est refusé à la saisie,
avant écriture et avant tout appel fournisseur (D27). Ailleurs, le refus arrive au
premier relevé de cours. La route ne consulte aucun fournisseur : une panne de cotation
ne rend pas le formulaire inutilisable.

Les nombres financiers peuvent être transmis sous forme de chaînes afin de préserver
leur précision. Une vente est validée contre tout l'historique chronologique et sous
verrou transactionnel : elle est refusée si le solde devient négatif à un instant
quelconque, y compris lorsqu'elle est antidatée ou concurrente. La suppression d'un
mouvement applique le même invariant : retirer un achat antérieur est refusé si une
vente ultérieure se retrouve sans quantité suffisante.

## Cours d'actions

Les symboles d'actions sont limités à la liste blanche serveur actée en D27. Les clés
`FMP_API_KEY`, `FINNHUB_API_KEY` et `ALPHA_VANTAGE_API_KEY` sont optionnelles et restent
hors du dépôt. Les fournisseurs sont essayés dans cet ordre, puis le cours USD est
converti en EUR via Frankfurter. Sans clé configurée ni dernier cours en cache, l'actif
reste enregistré mais sa valorisation est signalée indisponible.

## Cloisonnement

Les identifiants d'utilisateur ne sont jamais acceptés dans les corps ou les URL de ces
routes. Le propriétaire est lu dans le JWT et filtré dans chaque requête SQL. Un actif
absent et un actif appartenant à un autre compte produisent tous deux `404`, afin de ne
pas révéler l'existence d'une ressource tierce.

## Accès, révocation et session

**Le jeton ne suffit pas.** Chaque requête authentifiée relit l'état du compte : un compte
désactivé ou supprimé, et un jeton émis avant la borne de révocation du compte, rendent
`401` avec le message « Votre session a été close ». Le rôle est relu en base et non repris
du jeton, de sorte qu'un rôle retiré prenne effet immédiatement.

`401` et non `403`, à la différence de la connexion qui refuse un compte désactivé en
`403` : `401` signifie « cette session ne vaut plus », et c'est le signal auquel
l'interface réagit en vidant son état. La raison du refus est donnée à la reconnexion, où
elle a un sens.

**Changer son mot de passe pose la borne de révocation** : toutes les sessions ouvertes du
compte tombent. La réponse rend un jeton neuf, ce qui permet à la session courante de
survivre à l'opération pendant que les autres se ferment. C'est pour cela que la route rend
`200` avec un corps et non `204`.

## Limitation de débit

Le quota est porté par **l'adresse électronique soumise**, jamais par l'adresse IP. Ce
n'est pas un choix d'usage mais une conséquence mesurée : derrière le Nginx du projet,
`req.ip` vaut la même valeur pour tous les clients, la publication de port de Docker
traduisant l'adresse. Un quota par IP y compterait le monde entier sur un compteur unique.

| Route | Plafond | Ce qui est compté |
|---|---|---|
| `POST /api/auth/connexion` | 10 par quart d'heure | les échecs seuls ; une connexion réussie remet le compteur à zéro |
| `POST /api/auth/mot-de-passe-oublie` | 5 par quart d'heure | les demandes, la réponse étant toujours la même |
| `POST /api/auth/reinitialisation` | 10 par quart d'heure | les échecs seuls |

Le dépassement rend `429` et les en-têtes `RateLimit-*` de la version normalisée. Les
en-têtes hérités `X-RateLimit-*` sont désactivés.

L'inscription n'est pas plafonnée : un quota par adresse n'y protégerait de rien, puisque
créer des comptes en série se fait avec des adresses toutes différentes.

## Récupération d'un mot de passe

`POST /api/auth/mot-de-passe-oublie` rend toujours `202` et le même message, que l'adresse
corresponde ou non à un compte. Émettre une demande annule les précédentes du même compte.
La clé vaut une heure et ne sert qu'une fois ; seule son empreinte SHA-256 est conservée.

`POST /api/auth/reinitialisation` rend `204` sans connecter, et pose la borne de révocation :
toutes les sessions du compte se ferment. Un refus est unique pour ses quatre causes
possibles — clé inconnue, déjà servie, expirée, compte désactivé — pour ne pas apprendre
laquelle s'applique.

**Mode démonstration.** Le projet n'envoie pas de courriel. Quand
`AFFICHER_JETON_REINITIALISATION=true`, la réponse porte la clé en clair. Cette commodité
révèle l'existence du compte, puisque la clé n'apparaît que si l'adresse en a un : elle est
fermée par défaut et n'a rien à faire sur un déploiement réel.
