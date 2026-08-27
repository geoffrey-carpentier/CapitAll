# Spécification fonctionnelle et UX/UI

Référence unique pour la réalisation des maquettes et l'intégration de l'interface. Décrit ce que chaque écran affiche, comment il se comporte et dans quels états il peut se trouver.

Ne décrit pas : la palette et la typographie (`direction-artistique.md`), le formatage des valeurs numériques (`formatage-nombres.md`), le modèle de données (`modele-de-donnees.md`), les règles de calcul (`cahier-des-charges.md`).

---

# Partie I — Principes transverses

## 1. Lexique

Un même objet porte le même nom partout : interface, code, documentation, routes.

| Terme retenu | Désigne | À ne pas employer |
|---|---|---|
| **patrimoine** | la valeur totale consolidée | valorisation totale, capital |
| **position** | ce que l'utilisateur détient d'un actif | ligne, holding |
| **actif** | l'instrument lui-même (Bitcoin, l'or) | — |
| **mouvement** | un achat ou une vente | transaction, opération |
| **seuil** | une alerte de franchissement | alerte, notification |
| **prix de revient** | le coût unitaire moyen pondéré | PRU en toutes lettres dans l'interface |
| **cours** | le prix unitaire de marché | prix, valeur unitaire |

Le terme *notification* est proscrit de l'interface : l'application n'envoie rien, elle constate un franchissement à la consultation.

## 2. Système de navigation

Une seule interface, **deux points de rupture**.

**Sous 768 px** : barre de navigation basse fixe à cinq entrées, l'ajout d'un mouvement au centre en bouton circulaire proéminent. Les saisies s'ouvrent en feuille glissante depuis le bas, jamais en page. Le retour se fait par le geste de fermeture ou la flèche d'en-tête.

**À partir de 768 px** : rail latéral fixe de 212 px à cinq entrées, pied de rail portant l'identité de session et la déconnexion. Les saisies s'ouvrent en boîte de dialogue centrée. L'ajout d'un mouvement est un bouton d'action principal dans la barre de titre.

Entrées de navigation, dans cet ordre : Patrimoine, Positions, *(ajout)*, Seuils, Compte.

L'écran Détail d'une position n'est pas dans la navigation : on y accède depuis Positions ou depuis le tableau de bord.

## 3. Grammaire visuelle

**Trois niveaux de contenant, pas davantage.** Niveau 0, à plat sur le fond : listes, tableaux, formulaires longs. Niveau 1, carte bordée : blocs à frontière logique, graphe, répartition. Niveau 2, carte au fond accentué : le seul bloc de patrimoine. Un écran ne mélange jamais plus de deux niveaux.

**Rythme vertical à trois valeurs.** 32 px avant un changement de section, 24 px entre blocs d'une même section, 12 px entre éléments liés. L'espace au-dessus d'un titre est toujours supérieur à l'espace en dessous.

**Jeton de classe, par la forme et pas seulement par la couleur.** Cercle pour les cryptomonnaies, carré à coins arrondis pour les métaux, losange pour les devises, hexagone pour les actions. La forme reste lisible en niveaux de gris, ce qui sert l'accessibilité et donne à la liste une texture propre à l'application.

**Ligne de prix de revient.** Sur tout graphe de cours d'une position, le prix de revient est tracé en ligne horizontale pointillée, l'aire entre la courbe et cette ligne étant teintée en positif au-dessus et en négatif en dessous. C'est le geste graphique signature de l'application : il donne à voir en un regard l'information principale du produit.

## 4. Bibliothèque de composants

Existants dans le dépôt : `Bouton`, `Carte`, `Champ`, `Chargement`, `Alerte` (message), `RouteProtegee`, `Coquille`.

À créer, par ordre de dépendance :

| Composant | Rôle | Utilisé par |
|---|---|---|
| `Montant` | affiche une valeur selon la politique de formatage | tous |
| `Variation` | pourcentage ou montant signé, avec traitement graduel | E2, E3, E4 |
| `JetonClasse` | pastille de forme selon la classe d'actif | E2, E3, E4, E5 |
| `EtatVide` | illustration, titre, explication, action | E2, E3, E6 |
| `Squelette` | forme de chargement calquée sur le contenu attendu | E2, E3, E4 |
| `MessageErreur` | erreur avec cause et action de reprise | tous |
| `PastilleFraicheur` | ancienneté et source d'un cours | E2, E3, E4 |
| `SelecteurPeriode` | plages avec performance affichée par plage | E2, E4 |
| `Repartition` | répartition par classe, en liste chiffrée | E2 |
| `Courbe` | évolution, avec ligne de prix de revient optionnelle | E2, E4 |
| `TableauPositions` | liste responsive des positions | E2, E3 |
| `FrisesMouvements` | chronologie des mouvements avec effet sur le prix de revient | E4 |
| `Feuille` | conteneur glissant mobile, dialogue desktop | E5, E6 |
| `BarreProgression` | avancement vers un seuil | E4, E6 |
| `Confirmation` | dialogue de confirmation d'action destructrice | E4, E5, E7 |
| `BasculeDevise` | euro ou dollar | E2, E7 |
| `MasquageMontants` | bascule de confidentialité | E2, E7 |

## 5. Grammaire des états

Les sept états demandés sont définis **une fois ici** et ne sont rappelés dans chaque écran que par leurs particularités propres. Un état décrit sept fois à l'identique cesse d'être lu et diverge à la première évolution.

| État | Déclencheur | Traitement générique |
|---|---|---|
| **Chargement** | requête en cours, premier affichage | Squelette calqué sur la forme du contenu attendu, jamais un rond tournant plein écran. Pas d'affichage avant 200 ms pour éviter le clignotement sur réseau rapide. |
| **Données normales** | réponse reçue, contenu présent | — |
| **Absence de données** | réponse reçue, collection vide après filtrage | Message dans le contenant, sans illustration, avec action de réinitialisation du filtre. À distinguer strictement du portefeuille vide. |
| **Portefeuille vide** | compte sans aucune position | `EtatVide` avec action principale menant à la création de la première position. Voir 6. |
| **Premier lancement** | première connexion après inscription | Cas particulier du portefeuille vide, avec un texte d'accueil différent. Voir 6. |
| **Erreur API** | réponse 4xx ou 5xx | Cause en clair, jamais de code technique brut. 401 : redirection vers la connexion avec message de session expirée. 403, 404 : message dédié. 5xx : message générique et bouton de réessai. |
| **Erreur réseau** | requête sans réponse, hors ligne | Message distinct de l'erreur API : « connexion indisponible », bouton de réessai, conservation des données déjà affichées, grisées, plutôt que page blanche. |

**Deux états supplémentaires propres à l'application**, à ne pas oublier :

| État | Déclencheur | Traitement |
|---|---|---|
| **Cours en repli** | `cours_indisponibles` non vide dans la réponse | Bandeau d'avertissement nommant les actifs concernés et la date du dernier cours connu. `PastilleFraicheur` en état tiède sur les positions concernées. Les valorisations restent affichées, jamais masquées. |
| **Session expirée** | 401 sur une requête d'un écran déjà affiché | Le jeton vivant en mémoire, un rechargement ramène à la connexion. Message explicite plutôt que redirection silencieuse. |

## 6. Premier lancement, le parcours qui décide de tout

Un compte neuf n'a aucune position. Aujourd'hui, cela produirait un tableau de bord affichant zéro euro, quatre indicateurs vides et une répartition sans ligne : le pire accueil possible pour une application patrimoniale.

Parcours retenu : après inscription, l'utilisateur arrive sur le tableau de bord en état **premier lancement**. L'écran ne montre ni graphe ni répartition. Il montre un texte court expliquant ce que fait l'application, et une action principale unique, « Ajouter votre première position », qui ouvre directement le formulaire de mouvement pré-réglé sur un achat.

Après le premier enregistrement, le tableau de bord bascule en état normal. Tant qu'une seule position existe, le bloc de répartition reste masqué : une répartition à une seule ligne n'informe pas.

---

# Partie II — Spécification des écrans

## E1 — Connexion et inscription

**Objectif.** Ouvrir une session et créer un compte. Écran déjà intégré, spécifié ici pour la cohérence et pour la couverture de la maquette.

**Cas d'utilisation.** Première inscription ; connexion quotidienne ; retour après expiration de session.

**Informations affichées.** Identité de l'application et une phrase de positionnement. Formulaire. Lien de bascule entre les deux modes. Aucune donnée patrimoniale.

**Hiérarchie.** Le formulaire domine ; le positionnement est secondaire ; le lien de bascule est tertiaire.

**Composants.** `Champ` (adresse, mot de passe, pseudonyme à l'inscription), `Bouton` principal, `MessageErreur`, indicateur de robustesse du mot de passe à l'inscription.

**Interactions.** Validation à la soumission, pas à la frappe, sauf le mot de passe à l'inscription dont la robustesse s'évalue en direct. Entrée valide le formulaire. Après inscription réussie, connexion automatique et arrivée en premier lancement. Après connexion réussie, arrivée sur le tableau de bord.

**États particuliers.** Erreur API 409 à l'inscription : « cette adresse est déjà utilisée », le champ concerné reçoit le focus. Erreur 401 à la connexion : message unique « adresse ou mot de passe incorrect », jamais un message distinguant les deux cas, ce qui révélerait l'existence d'un compte. Soumission en cours : bouton désactivé avec libellé d'attente, pour empêcher le double envoi.

**Accessibilité.** Chaque champ porte un `label` visible, pas un simple `placeholder`. Les erreurs sont associées par `aria-describedby` et annoncées via une région `aria-live`. Le focus arrive sur le premier champ à l'ouverture, sur le premier champ en erreur après un échec. Contraste minimum 4,5:1, y compris sur les textes d'aide atténués.

**Questions ouvertes.** Aucune.

---

## E2 — Patrimoine (tableau de bord)

**Objectif.** Répondre en un regard à quatre questions, dans cet ordre : combien je possède, comment cela a évolué, comment c'est réparti, qu'est-ce qui demande mon attention. C'est l'écran d'arrivée et le plus consulté.

**Cas d'utilisation.** Consultation quotidienne rapide ; vérification après un mouvement ; constat d'un seuil franchi.

**Informations affichées et hiérarchie.**

*Priorité 1, dominante visuelle.* Le patrimoine total, en très grand, avec sa variation absolue et relative depuis l'origine. Bloc de niveau 2, occupant environ les deux tiers de la largeur en desktop.

*Priorité 2.* La courbe d'évolution et le sélecteur de période affichant la performance de chaque plage sans clic (jour, semaine, mois, année, origine). Cinq informations pour un regard.

*Priorité 3, sans carte, en colonne latérale sur desktop.* Montant investi, plus-value latente, plus-value réalisée. Trois lignes de texte séparées par des filets, pas trois cartes : ce sont des chiffres de contexte, pas des indicateurs de tête.

*Priorité 4.* Répartition par classe, en liste chiffrée : libellé, part et montant sur chaque ligne. La visualisation graphique en anneau a été retirée aux deux points de rupture (D74) ; la donnée, elle, est intégralement conservée.

*Priorité 5.* Seuils franchis, en liste courte, seulement s'il y en a. Le bloc disparaît entièrement s'il est vide.

*Priorité 6.* Les cinq positions les plus importantes, avec un lien vers l'écran Positions. Le tableau complet n'a pas sa place ici.

**Source.** `GET /api/portefeuille` fournit `valeur_totale`, `cout_total`, `plus_value_latente`, `plus_value_realisee`, `repartition`, `actifs`, `cours_indisponibles`, `taux_affichage`, `alertes_declenchees`. `GET /api/portefeuille/historique` fournit la courbe.

**Composants.** `Montant`, `Variation`, `SelecteurPeriode`, `Courbe`, `Repartition`, `TableauPositions` en mode réduit, `PastilleFraicheur`, `BasculeDevise`, `MasquageMontants`, `EtatVide`, `Squelette`, `MessageErreur`.

**Interactions.** La bascule euro-dollar convertit l'affichage sans nouvelle requête, le taux étant déjà dans la réponse ; le choix persiste dans la session. Le masquage remplace tout montant par une suite de points, y compris dans le graphe dont l'axe est masqué ; l'état persiste. Le sélecteur de période recharge la courbe. Un clic sur une classe de la légende filtre l'écran Positions et y navigue. Un clic sur une position ouvre son détail. Le bouton d'ajout ouvre E5.

**États particuliers.**

*Premier lancement et portefeuille vide.* Voir I.6. Ni courbe, ni répartition, ni indicateurs. Un texte, une action.

*Une seule position.* Bloc de répartition masqué : répartir un patrimoine entre une seule ligne n'a pas de sens.

*Historique insuffisant.* Moins de deux points de mesure : la courbe est remplacée par un message « l'évolution s'affichera après quelques jours de suivi ». Ne jamais tracer une courbe à un point.

*Cours en repli.* Bandeau nommant les actifs concernés. Le patrimoine reste affiché, avec la mention que la valorisation utilise le dernier cours connu.

*Chargement.* Squelette respectant la composition : un grand bloc, une zone de graphe, trois lignes, un cercle.

**Accessibilité.** La courbe porte un `role="img"` avec un `aria-label` décrivant la donnée en toutes lettres, et le sélecteur de période en donne la performance chiffrée : le tracé n'est jamais la seule source de l'information. La répartition n'étant plus un graphique mais une liste (D74), elle se lit directement, chaque entrée portant son libellé, sa part et son montant. Aucune information n'y est portée par la couleur : la classe est signalée par la forme du jeton (D76). Le sélecteur de période est un vrai groupe d'onglets navigable aux flèches. Le masquage des montants est annoncé par `aria-pressed`.

**Questions ouvertes.**
1. Le bloc des cinq principales positions fait-il doublon avec l'écran Positions ? Il évite un aller-retour mais ajoute de la hauteur. Recommandation : le conserver en desktop, le supprimer en mobile où le défilement est déjà long.
2. La période par défaut : mois ou année ? Recommandation : mois, plus proche du rythme réel de consultation, l'année étant à un clic.

---

## E3 — Positions

**Objectif.** Donner la vue exhaustive et comparable de ce qui est détenu, et permettre d'atteindre une position précise.

**Cas d'utilisation.** Vérifier une ligne ; comparer les performances ; filtrer une classe ; accéder au détail.

**Informations affichées et hiérarchie.** Une ligne par position. Par ordre de priorité de lecture : nom et jeton de classe, valorisation, variation, puis quantité et prix de revient en information secondaire de deuxième ligne.

En desktop, tableau à colonnes : Actif, Quantité, Cours, Prix de revient, Valorisation, Plus-value, tendance 30 jours. En mobile, liste à deux niveaux : jeton, nom et sous-ligne à gauche, valorisation et variation à droite.

**Contenant.** Niveau 0, à plat sur le fond, séparateurs entre les lignes. C'est une liste, pas un ensemble de cartes.

**Composants.** `TableauPositions`, `JetonClasse`, `Montant`, `Variation`, `PastilleFraicheur`, filtres par classe avec compteur, `EtatVide`, `Squelette`.

**Interactions.** Filtres par classe, cumulables, avec compteur ; le filtre est reflété dans l'URL pour être partageable et survivre à un rechargement. Tri par colonne en desktop, tri par menu en mobile ; tri par défaut sur la valorisation décroissante. Un clic ou un appui sur une ligne ouvre le détail. Le bouton d'ajout ouvre E5.

**États particuliers.** *Absence de données après filtrage* : message dans la liste et action de réinitialisation, l'en-tête et les filtres restant affichés. *Portefeuille vide* : `EtatVide` avec action de création. *Cours en repli* : pastille tiède sur les lignes concernées et bandeau en tête de liste.

**Accessibilité.** Table sémantique en desktop, avec `scope` sur les en-têtes ; le tri est annoncé par `aria-sort`. En mobile, liste et non tableau, chaque élément étant un lien dont le texte accessible reprend le nom de l'actif et sa valorisation, jamais « voir » seul. Les filtres sont des boutons à `aria-pressed`. Zone tactile minimale 44 px.

**Questions ouvertes.**
1. Faut-il permettre la suppression d'une position depuis la liste ? Elle est destructrice et la route existe. Recommandation : non, uniquement depuis le détail, avec confirmation. Une action destructrice ne se place pas dans une liste où l'appui est fréquent.

---

## E4 — Détail d'une position

**Objectif.** Comprendre une position : ce qu'elle vaut, ce qu'elle a coûté, comment on y est arrivé, et ce qui la surveille.

**Cas d'utilisation.** Vérifier un prix de revient ; relire l'historique d'achat ; ajouter un mouvement sur un actif connu ; poser un seuil.

**Informations affichées et hiérarchie.**

*En-tête.* Jeton, nom, symbole, classe, source du cours et sa fraîcheur.

*Priorité 1.* Valorisation de la position et plus-value latente, absolue et relative.

*Priorité 2.* Trio quantité détenue, cours actuel, prix de revient.

*Priorité 3.* Graphe du cours **avec la ligne de prix de revient** (voir I.3) et sélecteur de période.

*Priorité 4, en onglets.* Mouvements ; Seuils. L'onglet « Analyse » présent dans les maquettes est supprimé : il ne contenait rien de défini.

*Onglet Mouvements.* Frise chronologique : type, date, quantité signée, montant, prix unitaire, frais, et **effet sur le prix de revient**. Une vente affiche en outre la plus-value réalisée.

*Onglet Seuils.* Seuils posés sur cet actif, avec progression vers le franchissement.

**Composants.** `Courbe` avec ligne de prix de revient, `SelecteurPeriode`, `FrisesMouvements`, `BarreProgression`, `Confirmation`, `Montant`, `Variation`, `JetonClasse`, `PastilleFraicheur`.

**Interactions.** Ajout d'un mouvement pré-réglé sur cet actif. Création d'un seuil pré-réglée sur cet actif. Suppression d'un mouvement, avec confirmation nommant explicitement la conséquence : « la suppression de cet achat recalculera le prix de revient de la position ». Suppression de la position, avec confirmation mentionnant que les mouvements associés seront supprimés.

**États particuliers.** *Position sans mouvement* : cas impossible dans le modèle, un actif naissant d'un premier achat ; à traiter tout de même en défensif par un message neutre. *Cours indisponible* : le graphe affiche la dernière valeur connue et une zone grisée pour la période manquante, jamais une interpolation. *Erreur 404* : la ressource d'un autre compte est traitée comme inexistante ; message « position introuvable » et retour à la liste.

**Accessibilité.** La frise est une liste ordonnée sémantique. La ligne de prix de revient est décrite dans l'`aria-label` du graphe. Les onglets suivent le motif ARIA d'onglets, navigables aux flèches, avec `aria-controls`. La confirmation de suppression capture le focus, se ferme par Échap, et son bouton destructeur n'est jamais le premier dans l'ordre de tabulation.

**Questions tranchées.**
1. La colonne « effet sur le prix de revient » est calculée **côté serveur**, dans le détail d'actif, conformément à la recommandation. Chaque mouvement y porte le prix de revient avant et après, son déplacement, la quantité restante, le montant de l'opération et, pour une vente, la plus-value qu'elle dégage à elle seule. Le chiffre ne se retrouve pas en rejouant un calcul isolé : il faut avoir rejoué toute l'histoire de la position dans le même ordre et avec les mêmes arrondis, ce que seul le moteur sait faire.
2. Le graphe de cours est alimenté par l'historique par position introduit par **D81**. Un actif dont l'historique compte moins de deux points affiche l'état « pas assez de points », jamais une interpolation.

---

## E5 — Mouvement (achat ou vente)

**Objectif.** Enregistrer une opération et en montrer l'effet avant validation. C'est l'écran le plus important après le tableau de bord : c'est là que se crée la donnée.

**Forme.** Feuille glissante en mobile, dialogue centré en desktop. Jamais une page : le contexte doit rester visible.

**Cas d'utilisation.** Premier ajout depuis l'état vide ; achat sur un actif déjà détenu ; vente partielle ou totale ; saisie rétroactive d'une opération passée.

**Informations affichées et hiérarchie.** Bascule achat ou vente en tête, colorée et explicite. Sélection de l'actif, avec création d'un actif inexistant dans le même geste. Quantité et prix unitaire. Date. Frais, facultatif. Puis, en bas et mis en évidence, le **récapitulatif recalculé en direct** : montant de l'opération, quantité détenue après, nouveau prix de revient et son écart. Pour une vente : plus-value réalisée par l'opération.

**Composants.** `Feuille`, `Champ`, `JetonClasse`, `Bouton`, `Montant`, `Variation`, `Message`, et un sélecteur d'actif. Celui-ci est une liste déroulante native, comme dans la maquette : elle se parcourt à la frappe, reste utilisable au clavier comme au doigt sans code à maintenir, et un portefeuille de quelques dizaines de positions ne justifie pas un champ de recherche.

**Interactions.** Le prix unitaire est pré-rempli au cours du jour et reste modifiable, avec une mention explicite. Une vente ne propose jamais une quantité supérieure à la quantité détenue : le champ est borné et un raccourci « tout vendre » est proposé. La date ne peut pas être future. La validation est bloquée tant que le récapitulatif ne peut pas être calculé. À l'enregistrement, la feuille se ferme et l'écran d'origine se rafraîchit, avec confirmation brève.

**Validations.** Quantité strictement positive, dans la précision de la classe. Prix unitaire positif. Date passée ou du jour. Frais positifs ou nuls. Les messages nomment le champ et la règle, jamais un code.

**États particuliers.** *Actif nouveau* : les champs de classe, de symbole et de nom apparaissent, et l'actif est créé avant la saisie du mouvement. *Cours indisponible* : le prix unitaire n'est pas pré-rempli, un message l'explique, la saisie manuelle reste possible. *Erreur de validation* : le serveur répond 400 en nommant chaque champ fautif, et ces messages sont replacés sur les champs concernés, jamais affichés en bloc ; un refus de règle de gestion, qui ne nomme pas de champ, s'affiche tel quel. *Enregistrement en cours* : bouton désactivé, formulaire verrouillé.

**Accessibilité.** La feuille est un dialogue modal : focus capturé, retour au déclencheur à la fermeture, fermeture par Échap. Le récapitulatif est une région `aria-live="polite"` : ses recalculs sont annoncés sans interrompre la saisie. Les champs numériques portent `inputmode="decimal"`. La bascule achat ou vente est un groupe de boutons radio, pas une paire de boutons.

**Questions tranchées.**
1. La création d'un actif se fait **depuis le formulaire**, conformément à la recommandation. Elle y forme une étape distincte : l'actif est créé, puis le mouvement se saisit sur la position ainsi ouverte. Sans cela, le récapitulatif ne pourrait porter sur rien et la règle « pas de validation sans récapitulatif » tomberait précisément sur le premier achat, celui d'un portefeuille vide.
2. Le champ frais est **conservé et visible**, apparié à la date comme dans la maquette validée, plutôt que replié derrière un lien. Il porte la mention « facultatif » et rappelle que les frais d'achat entrent dans le prix de revient.

**Impacts API.** `POST /api/actifs/:id/transactions/simulation` rend l'effet du mouvement sur la position sans rien écrire : montant, quantité détenue avant et après, prix de revient avant et après, déplacement du prix de revient, et plus-value dégagée par une vente. Le récapitulatif est un état métier, il ne se reconstitue pas dans l'interface (D69).

**Devise de saisie.** Le formulaire est en euros, devise de référence des calculs et du stockage. La bascule euro-dollar des écrans de restitution ne s'y applique pas : elle ne change que l'affichage, alors qu'un montant saisi est celui qui sera enregistré.

---

## E6 — Seuils

**Objectif.** Surveiller sans consulter en permanence. Répondre à une seule question devant chaque ligne : suis-je proche ?

**Cas d'utilisation.** Poser un seuil sur un actif ou sur le patrimoine total ; constater un franchissement ; retirer un seuil devenu inutile.

**Informations affichées et hiérarchie.** Deux groupes : franchis, puis en cours. Chaque ligne porte la cible, le sens et la valeur du seuil, l'écart restant en pourcentage, et une barre de progression. Les franchis portent la date de franchissement.

**Contenant.** Cartes de niveau 1, la progression justifiant une frontière visuelle.

**Composants.** `BarreProgression`, `JetonClasse`, `Feuille` pour la création, `Confirmation`, `EtatVide`.

**Interactions.** Création via une feuille présentant le cours actuel en grand, la bascule au-dessus ou en dessous, le champ de seuil, et des décalages rapides à −10, −5, +5 et +10 %. La cible peut être un actif ou le patrimoine total, conformément au modèle. Un texte en clair rappelle la règle : le seuil est inclusif et le franchissement ne se produit qu'une fois. Confirmation brève après création. Retrait d'un seuil avec confirmation simple.

**États particuliers.** *Aucun seuil* : `EtatVide` expliquant l'intérêt et proposant la création. *Cours indisponible sur la cible* : la progression n'est pas calculable, la barre est remplacée par une mention explicite plutôt que par une barre à zéro, qui mentirait.

**Accessibilité.** La barre de progression porte `role="progressbar"` avec ses valeurs. Le pourcentage restant est toujours écrit en toutes lettres à côté : la barre seule ne porte jamais l'information. Le groupe des seuils franchis est annoncé par un titre de section, pas seulement par une couleur.

**Questions tranchées.**
1. Un seuil franchi n'est **pas réarmable** au MVP, conformément à la recommandation : l'API n'expose que la désactivation, jamais un retour au statut `active`. Un utilisateur qui veut à nouveau surveiller la même cible recrée un seuil.

**Impacts API.** L'écran ne demande aucune route nouvelle. Chaque alerte rendue par `GET /api/alertes` porte deux champs additifs, `valeur_observee` et `ecart_pourcentage` : la valeur actuellement constatée sur la cible et l'écart relatif qu'il lui reste à parcourir avant franchissement, tous deux calculés côté serveur (D69). Un cours indisponible sur la cible rend les deux champs nuls, l'écran affichant alors la mention prévue plutôt qu'une barre à zéro.

---

## E7 — Compte

**Objectif.** Donner à l'utilisateur la maîtrise de son compte et de ses données. Écran absent de toutes les maquettes, et son absence se verrait immédiatement en démonstration.

**Cas d'utilisation.** Changer son mot de passe ; se déconnecter ; supprimer son compte ; régler l'affichage ; savoir d'où viennent les cours.

**Structure.** Un seul écran, cinq sections, sans sous-navigation.

*Compte.* Adresse électronique, pseudonyme, date d'inscription, rôle. Lecture seule au MVP.

*Sécurité.* Changement du mot de passe : ancien mot de passe, nouveau, confirmation. Déconnexion. Suppression du compte.

*Affichage.* Devise d'affichage euro ou dollar. Masquage des montants par défaut.

*Données.* Export de la totalité des mouvements du compte au format CSV (D84). Portée intégrale, tous actifs confondus, sans filtre de période ni d'actif. Huit colonnes, dans cet ordre : `date`, `type`, `actif`, `classe`, `quantite`, `prix_unitaire`, `frais`, `montant`. La colonne `actif` porte le symbole, unique par compte, et non le nom. La colonne `montant` est la quantité multipliée par le prix unitaire, **frais exclus**, ceux-ci occupant leur propre colonne ; elle reprend la valeur produite par le moteur de calcul et n'est pas recalculée pour l'export (D69). Fichier UTF-8 avec marque d'ordre des octets, séparateur point-virgule, fin de ligne CRLF, dates en ISO 8601, nombres décimaux bruts à point, sans mise en forme : un fichier d'échange n'est pas un affichage. Lignes en ordre chronologique ascendant, tous actifs confondus, celui de la règle 6 de D54. Nom du fichier `capitall-mouvements-AAAA-MM-JJ.csv`.

*À propos.* Version de l'application, sources de cours utilisées et leur fréquence de rafraîchissement, mention explicite que l'application ne fournit aucun conseil en investissement.

**Composants.** `Champ`, `Bouton`, `Carte`, `BasculeDevise`, `MasquageMontants`, `Confirmation`, `Message`, `MessageErreur`.

**Interactions.** Le changement de mot de passe exige l'ancien et n'invalide pas la session en cours, le jeton étant signé sur l'identifiant et le rôle et jamais sur le mot de passe. La suppression du compte demande une confirmation par saisie du mot de passe et énonce sans ambiguïté ce qui sera supprimé, positions, mouvements et seuils compris, et que l'opération est irréversible. **Ce mot de passe est vérifié par le serveur** : contrôlé par la seule interface, il ne protégerait pas d'un appel direct porteur d'un jeton dérobé. L'export est obtenu par un appel authentifié puis remis à l'utilisateur depuis la page ; il ne peut pas être un simple lien, le jeton ne vivant qu'en mémoire (D57) et n'accompagnant pas une navigation du navigateur.

**Impacts API, à créer.** `PATCH /api/compte/mot-de-passe`, `DELETE /api/compte` (le mot de passe de confirmation est transmis dans le corps) et `GET /api/compte/export-mouvements`, seule route du service à ne pas répondre en JSON. Les données du compte proviennent de `GET /api/auth/moi`, déjà disponible.

**États particuliers.** *Ancien mot de passe incorrect* : erreur sur le champ concerné, sans indication de tentatives restantes. *Suppression en cours* : formulaire verrouillé, puis déconnexion et retour à la connexion avec message de confirmation. *Mot de passe de suppression incorrect* : erreur sur le champ du dialogue, le compte restant intact. *Compte sans aucun mouvement* : l'export produit un fichier réduit à sa ligne d'en-tête, un fichier vide laissant croire à un échec. *Export en échec* : message dans la section Données, sans quitter l'écran.

**Accessibilité.** Les sections sont des `section` avec titre. Le dialogue de suppression capture le focus et ne présélectionne jamais le bouton destructeur. Les réglages d'affichage sont des interrupteurs à `aria-checked`, avec un libellé qui décrit l'état et non l'action.

**Questions ouvertes.**
1. Le pseudonyme doit-il être modifiable ? Le modèle le permet, une route `PATCH` de plus. Recommandation : non au MVP, l'information ayant peu d'usage dans l'application.

---

# Partie III — Cohérence et parcours

## Parcours principaux

*Découverte.* Inscription, premier lancement, création de la première position, retour au tableau de bord renseigné. Trois écrans, aucune impasse.

*Quotidien.* Connexion, tableau de bord, éventuellement détail d'une position. Zéro saisie.

*Enregistrement.* Depuis n'importe quel écran, bouton d'ajout, feuille, récapitulatif, validation, retour à l'écran d'origine rafraîchi.

*Surveillance.* Tableau de bord, seuils franchis en évidence, détail de la position concernée.

## Règles métier visibles dans l'interface

Ces règles sont énoncées à l'écran, en français, pour que le comportement ne surprenne jamais.

- Le prix de revient est une moyenne pondérée ; une vente ne le modifie pas.
- Une vente ne peut pas excéder la quantité détenue.
- Un seuil est inclusif et ne se déclenche qu'une fois.
- Les seuils sont évalués à la consultation du portefeuille, aucun envoi n'est effectué.
- Quand un cours est indisponible, la dernière valeur connue est utilisée et signalée.
- La devise de référence des calculs est l'euro ; la bascule ne change que l'affichage.

## Points de vigilance identifiés

1. Deux routes restent à créer pour E7.
2. L'écran d'administration prévu au périmètre n'est pas spécifié ici : il relève d'un parcours distinct et d'un rôle distinct.
3. Le formatage des valeurs doit passer sans exception par le module dédié, sous peine de divergence entre écrans.
