# Feuille de route

**Mise à jour : 24 septembre 2026.** Ce document dit où va le produit et dans quel ordre. Ce qu'il fait aujourd'hui est dans `etat.md`.

Une règle gouverne cette feuille de route : **une hypothèse n'est pas une priorité**. Une fonctionnalité n'entre dans une phase qu'après avoir été confirmée par une observation, une mesure ou un besoin exprimé. Les hypothèses sont listées telles quelles, et la phase de découverte existe pour les trancher.

## Phase en cours — Socle de gouvernance

Rendre le projet reprenable par un contributeur qui ne dispose que du dépôt : guide de contribution, exigences de qualité, décisions d'architecture, état produit, feuille de route, correspondance avec le référentiel de compétences. Protection des branches et contrôles automatiques bloquants.

**Terminée quand** un contributeur peut cloner, comprendre, contribuer et livrer sans autre source.

## Phase suivante — Qualification de la base existante

Reprendre depuis une copie propre la totalité des contrôles qui n'ont pas été rejoués : tests d'intégration, construction, reconstruction des images, parcours réel au navigateur, accessibilité, performance. Étiqueter la version ainsi qualifiée.

**Terminée quand** un rapport daté dit ce qui passe, ce qui échoue et ce qui reste inconnu.

## Phase 3 — Découverte produit

Confronter le produit à des utilisateurs réels, et non au seul jugement de son auteur. Parcours observés, irritants reproduits et mesurés, valeur attendue de chaque manque connu.

Hypothèses à trancher dans cette phase :

- l'absence d'historique à l'ajout d'un actif décourage-t-elle l'usage ;
- l'import de mouvements est-il attendu, et sous quelle forme ;
- la durée de session et sa perte à la fermeture de l'onglet gênent-elles réellement ;
- le multi-portefeuille, la consultation hors ligne, une page publique répondent-ils à un besoin, ou à une intuition.

**Terminée quand** chaque hypothèse ci-dessus est confirmée ou écartée, preuve à l'appui.

## Phase 4 — Architecture cible

Instruire les choix restés ouverts, chacun par une décision écrite : modèle de menace et conséquences sur la session, reprise d'historique des cours et ses contraintes de licence et de fuseau, relevés planifiés, couche de données côté interface. Aucun de ces sujets n'est tranché aujourd'hui.

**Terminée quand** les décisions correspondantes sont dans `../adr/`, avec leurs critères et leurs conséquences.

## Phase 5 — Fiabilité et exploitation

Ce que les phases précédentes auront confirmé, plus ce qui est déjà identifié comme manquant : contrôles d'intégration automatisés, analyse des dépendances et des secrets, barrière d'erreur côté interface, parcours de bout en bout, journalisation exploitable, sauvegarde dont la restauration est testée.

**Terminée quand** un incident courant se diagnostique et se répare à partir de la documentation seule.

## Phase 6 et au-delà — Valeur produit

Tranches verticales, une valeur utilisateur à la fois, dans l'ordre que la découverte aura établi. Rien n'est arrêté ici pour l'instant, et c'est volontaire.

## Ce qui n'est pas prévu

Conseil en placement, exécution d'ordres, connexion à un compte bancaire ou à une plateforme d'échange, application mobile native. Ces sujets sortent du périmètre et changeraient la nature du produit comme ses obligations réglementaires.
