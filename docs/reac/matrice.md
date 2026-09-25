# Correspondance avec le référentiel DWWM

Ce document relie les compétences du titre professionnel Développeur web et web mobile (référentiel V04) aux réalisations du dépôt et à leurs preuves. Il sert de fil de traçabilité : chaque compétence renvoie à du code, à un document et à un contrôle vérifiable.

**Mise à jour : 24 septembre 2026.** La correspondance est tenue au niveau des ensembles de travail et des versions, pas à celui de chaque contribution : forcer une compétence sur chaque petite tâche produirait une traçabilité fictive.

## Activité type 1 — Partie front-end

| Compétence | Réalisations | Preuves |
|---|---|---|
| **CP1** Installer et configurer l'environnement de travail | Monorepo, scripts de lancement, analyse statique, suites de tests, contrôles automatiques sur chaque pull request, pile de conteneurs de développement | `../adr/0001`, `../../.github/workflows/`, `../../docker-compose.yml`, `../contribuer.md` |
| **CP2** Maquetter des interfaces | Maquettes des écrans en mobile et en grand écran, système de jetons de style, contrastes vérifiés | `../conception/direction-artistique.md`, `../adr/0019` |
| **CP3** Réaliser des interfaces statiques | Intégration responsive, structure sémantique, navigation au clavier, zones interactives conformes, états vides et de chargement | `../../frontend/src/composants/`, `../../frontend/src/styles/`, `../qualite.md` §3 |
| **CP4** Développer la partie dynamique | Application React : routage public et privé, formulaires validés, restitution des valorisations, graphiques, gestion des erreurs et des sessions | `../../frontend/src/pages/`, `../adr/0005`, `../adr/0015`, 383 tests d'interface |

## Activité type 2 — Partie back-end

| Compétence | Réalisations | Preuves |
|---|---|---|
| **CP5** Mettre en place une base de données relationnelle | Modèle conceptuel puis physique, huit tables, contraintes d'intégrité, types numériques exacts, migrations versionnées avec registre d'empreintes | `../conception/modele-de-donnees.md`, `../../backend/db/schema.sql`, `../adr/0006`, `../adr/0007` |
| **CP6** Développer des composants d'accès aux données | Couche d'accès en requêtes paramétrées, cloisonnement prouvé dans le SQL, transactions et verrous, cache Redis avec repli | `../../backend/src/models/`, `../adr/0012`, `../adr/0013`, `../adr/0008` |
| **CP7** Développer des composants métier côté serveur | Moteur de calcul décimal exact, prix de revient et plus-values, adaptateurs de cours, authentification, validation des entrées, plafonds de tentatives | `../adr/0003`, `../adr/0004`, `../adr/0009`, `../adr/0014`, 410 tests unitaires et 22 tests d'intégration |
| **CP8** Documenter le déploiement | Images multi-étapes, exécution non privilégiée, rôle de base restreint, procédure de déploiement, de sauvegarde et de restauration | `../deploiement.md`, `../adr/0020`, `../../backend/Dockerfile`, `../../frontend/Dockerfile` |

## Comment cette correspondance se tient à jour

- Chaque ensemble de travail indique, à son ouverture, les compétences qu'il touche.
- Une preuve est un élément vérifiable par un tiers : un fichier du dépôt, une exécution de contrôle, une capture d'un parcours réel.
- Une compétence dont la preuve a vieilli est signalée ici plutôt que laissée en l'état : une correspondance fausse est pire qu'une case vide.
