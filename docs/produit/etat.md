# État du produit

**Dernière vérification : 24 septembre 2026.** Ce document dit ce que l'application fait aujourd'hui, ce qu'elle ne fait pas, et ce qui reste à contrôler. Ce qui est prévu ensuite est dans `roadmap.md`. Les choix qui fondent ces comportements sont dans `../adr/`.

## 1. Ce que l'application fait

**Compte.** Inscription, connexion, déconnexion. Mot de passe oublié et réinitialisation par clé à usage unique, sans envoi de courriel (`../adr/0016`). Changement de mot de passe. Suppression du compte, confirmée par le mot de passe et vérifiée côté serveur, qui efface l'ensemble des données rattachées. Export CSV des mouvements (`../adr/0017`).

**Actifs et mouvements.** Création d'un actif dans quatre classes : cryptomonnaies, devises, métaux précieux, actions. Renommage et suppression. Saisie d'entrées et de sorties, avec frais dans leur unité d'origine, correction et suppression d'un mouvement existant. Avant enregistrement, le serveur rend l'effet exact du mouvement sur la position.

**Valorisation.** Prix de revient unitaire moyen pondéré, plus-value latente, plus-value réalisée, valeur de chaque position et capital total, selon les sept règles de `../adr/0004`. Cours récupérés auprès de quatre familles de fournisseurs, mis en cache, avec repli daté sur le dernier cours connu (`../adr/0008`, `../adr/0009`).

**Restitution.** Tableau de bord : capital, variation, répartition par classe en anneau, courbe d'évolution sur plusieurs plages. Liste des positions. Écran de détail par position, avec frise des mouvements et historique du cours. Bascule d'affichage euro / dollar, masquage des montants.

**Seuils.** Création d'un seuil sur le cours d'un actif ou sur le capital total, évaluation à l'actualisation du tableau de bord, désactivation (`../adr/0011`).

## 2. Ce que l'application ne fait pas

- **Aucun import** de mouvements : ni fichier, ni connexion à une plateforme. Toute la saisie est manuelle.
- **Aucun historique antérieur à la première visite** : la courbe d'un actif commence au premier relevé fait par l'application (`../adr/0010`).
- **Aucun envoi de courriel** : ni vérification d'adresse, ni notification, ni lien de réinitialisation.
- **Un seul portefeuille** par compte, sans regroupement ni comparaison.
- **Aucune modification d'un seuil** une fois créé : il se désactive, il ne se corrige pas.
- **Aucun espace d'administration**, aucune annonce, bien que la table correspondante existe.
- **Aucune page publique** : la racine mène à la connexion, et une adresse inconnue y mène aussi.
- **Session de deux heures**, perdue à la fermeture de l'onglet, sans renouvellement (`../adr/0015`).

## 3. Chiffres vérifiés au 24 septembre 2026

| Élément | Valeur |
|---|---|
| Tables | 8, dont une sans usage (`annonce`) |
| Migrations | 6, rejouables, avec registre d'empreintes |
| Routes déclarées dans les routeurs | 25, plus la route de santé |
| Tests serveur unitaires | 410, verts |
| Tests d'intégration contre PostgreSQL | 22, non exécutés dans les contrôles automatiques |
| Tests d'interface | 383, verts |
| Analyse statique | sans avertissement des deux côtés |

## 4. Limites connues et non résolues

**Exploitation.** La pile de conteneurs est une pile de démonstration : pas de TLS, cache sans persistance, sauvegardes manuelles et jamais testées en restauration, journalisation réduite à la sortie standard, contrôle de santé qui ne vérifie ni la base ni le cache (`../adr/0020`).

**Sécurité.** Pas d'en-têtes de sécurité quand l'API est exposée sans son serveur frontal. Pas de plafond sur les inscriptions. Le plafond de connexion est compté par adresse électronique, ce qui permet à un tiers d'épuiser les tentatives d'un compte, et il est tenu en mémoire du processus. Les clés des fournisseurs d'actions circulent en paramètre d'URL.

**Interface.** Aucune barrière d'erreur : une erreur de rendu vide la page. Pas de cache de données côté client. Trois composants ont largement dépassé la taille raisonnable.

**Documentation.** Certaines pages de conception décrivent encore un état antérieur du code ; le plus visible est signalé dans la page concernée.

## 5. Contrôles non exécutés à cette date

Tests d'intégration, construction de l'interface, reconstruction des images, parcours réel au navigateur, mesures de performance et d'accessibilité, analyse de sécurité dynamique. Tant qu'ils n'ont pas été rejoués, l'état ci-dessus vaut pour les suites unitaires et la lecture du code, pas pour le comportement observé.
