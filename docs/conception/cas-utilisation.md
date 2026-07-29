# Cas d'utilisation - CapitAll

## Acteurs

- **Visiteur** : personne non authentifiée. Ne peut que s'inscrire ou se connecter.
- **Utilisateur inscrit** : acteur principal. Gère son portefeuille et consulte ses données.
- **Administrateur** : utilisateur inscrit doté du rôle admin (D23). Hérite des capacités de l'utilisateur inscrit pour son propre portefeuille, et dispose en plus de capacités d'administration à moindre privilège : publication d'annonces, liste et désactivation de comptes, statistiques agrégées. Il n'accède jamais aux portefeuilles des autres utilisateurs.
- **Fournisseurs de cours** (acteur secondaire, système externe) : Coinbase, Frankfurter, gold-api.com, Finnhub et Alpha Vantage (actions, D20), interrogés par le serveur pour valoriser les actifs.

## Liste des cas d'utilisation

| Cas d'utilisation | Acteur | Précondition |
|---|---|---|
| S'inscrire | Visiteur | email non déjà utilisé |
| Se connecter | Visiteur | compte existant |
| Se déconnecter | Utilisateur inscrit | connecté |
| Ajouter un actif suivi | Utilisateur inscrit | connecté |
| Modifier / supprimer un actif | Utilisateur inscrit | propriétaire de l'actif |
| Enregistrer une transaction (achat ou vente) | Utilisateur inscrit | actif existant, quantité vendue disponible |
| Consulter le détail d'un actif (PRU, plus-values latente et réalisée) | Utilisateur inscrit | propriétaire de l'actif |
| Consulter le tableau de bord consolidé | Utilisateur inscrit | connecté |
| Définir une alerte de seuil (sur un actif ou sur le capital total) | Utilisateur inscrit | connecté ; propriétaire de l'actif si l'alerte cible un actif |
| Consulter / désactiver ses alertes | Utilisateur inscrit | propriétaire de l'alerte |
| Consulter l'historique de valorisation du portefeuille | Utilisateur inscrit | connecté |
| Consulter les annonces | Utilisateur inscrit | connecté |
| Publier / modifier / épingler / supprimer une annonce | Administrateur | rôle admin |
| Lister les comptes, désactiver un compte | Administrateur | rôle admin |

Le cas « consulter le détail d'un actif » et le cas « consulter le tableau de bord » incluent tous deux la récupération du cours courant auprès du fournisseur correspondant (relation d'inclusion). En cas d'indisponibilité du fournisseur, le dernier cours connu en cache est affiché avec sa date.

Le cas « consulter le tableau de bord » inclut également l'évaluation des alertes actives de l'utilisateur et l'enregistrement du snapshot de valorisation du jour s'il n'existe pas encore.

La suppression d'un actif entraîne la suppression de ses transactions et des alertes qui le ciblent ; une confirmation explicite est demandée.

## Source du diagramme (PlantUML)

```plantuml
@startuml
left to right direction
actor Visiteur as V
actor "Utilisateur inscrit" as U
actor Administrateur as A
actor "Fournisseurs de cours" as API <<système>>
A --|> U

rectangle CapitAll {
  usecase "S'inscrire" as UC1
  usecase "Se connecter" as UC2
  usecase "Se déconnecter" as UC3
  usecase "Gérer ses actifs suivis\n(ajout, modification, suppression)" as UC4
  usecase "Enregistrer une transaction\n(achat / vente)" as UC5
  usecase "Consulter le détail d'un actif\n(PRU, plus-values latente et réalisée)" as UC6
  usecase "Consulter le tableau de bord\nconsolidé" as UC7
  usecase "Récupérer le cours courant" as UC8
  usecase "Définir une alerte de seuil" as UC9
  usecase "Consulter / désactiver ses alertes" as UC10
  usecase "Consulter l'historique\nde valorisation" as UC11
  usecase "Consulter les annonces" as UC12
  usecase "Gérer les annonces\n(publier, épingler, supprimer)" as UC13
  usecase "Gérer les comptes\n(lister, désactiver)" as UC14
}

V --> UC1
V --> UC2
U --> UC3
U --> UC4
U --> UC5
U --> UC6
U --> UC7
U --> UC9
U --> UC10
U --> UC11
U --> UC12
A --> UC13
A --> UC14
UC6 ..> UC8 : <<include>>
UC7 ..> UC8 : <<include>>
UC8 --> API
@enduml
```

Diagramme à exporter en PNG depuis plantuml.com ou l'extension VS Code PlantUML pour intégration au dossier de projet.
