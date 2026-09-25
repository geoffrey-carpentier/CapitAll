# Convention de commits

Format des messages et nommage des branches. Le déroulé complet d'une contribution — critères de départ, relecture, fin de travail, sessions — est dans `contribuer.md` ; le flux de branches et ses raisons sont dans `adr/0001-monorepo-et-flux-de-branches.md`.

Convention adoptée en juillet 2026 : Conventional Commits, messages en français, granularité par lot fonctionnel cohérent.

## Format

```
type(scope): description courte au présent, à la voix active, sans point final (#X)

corps optionnel, uniquement si le pourquoi n'est pas évident depuis le titre et le code
```

`(#X)` référence l'issue GitHub traitée par le commit ; `X` est son numéro.

## Branches

Une branche par **lot fonctionnel cohérent**, créée depuis `dev` : `<type>/<numéro>-<slug>`, où le type est l'un de ceux du tableau ci-dessous et le slug une suite courte de mots en minuscules séparés par des tirets — par exemple `feat/9-authentification` ou `docs/151-socle-gouvernance`. Le numéro est celui de l'issue principale du lot.

À l'intérieur du lot, chaque issue garde son commit, avec son suffixe `(#X)` : l'historique reste granulaire, seule la fréquence des branches et des pull requests diminue. Un lot regroupe des travaux qui n'ont pas d'intérêt à être livrés séparément, comme la chaîne d'authentification (configuration, inscription, connexion, middlewares).

La branche se ferme par une pull request vers `dev` (jamais vers `main`), dont la description liste toutes les issues du lot. Le mot-clé `Closes #X` ne ferme l'issue automatiquement qu'à la fusion dans la branche par défaut, qui est `main` : les pull requests étant fusionnées dans `dev`, **chaque issue se ferme à la main une fois la fusion faite**, et la version est renseignée quand le travail sort sur `main`.

## Types autorisés

| Type | Usage |
|---|---|
| `feat` | nouvelle fonctionnalité visible pour l'utilisateur ou l'API |
| `fix` | correction de bug |
| `docs` | documentation uniquement (README, dossier de projet, commentaires isolés) |
| `refactor` | changement de structure du code sans changement de comportement |
| `test` | ajout ou modification de tests |
| `chore` | tâches d'entretien : dépendances, configuration, tooling, seed de données |
| `build` | changement du système de build ou des dépendances externes (Dockerfile inclus) |
| `perf` | amélioration de performance mesurable |
| `style` | formatage sans impact fonctionnel, à éviter isolément si possible (regrouper avec le commit fonctionnel concerné) |

## Scope

Optionnel mais recommandé dans un monorepo, pour situer immédiatement le commit sans l'ouvrir : `front`, `back`, `db`, `docker`, `docs`.

## Exemples réalistes pour CapitAll

- `feat(back): ajoute le calcul du PRU moyen pondéré (#23)`
- `fix(back): corrige la vérification de propriété sur la suppression d'un actif (#31)`
- `feat(front): ajoute le formulaire d'ajout de transaction (#35)`
- `feat(db): ajoute les tables alerte et snapshot_valorisation (#8)`
- `docs: met à jour le README avec la procédure de déploiement (#52)`
- `chore(db): ajoute le script de seed (#6)`
- `test(back): ajoute les tests unitaires du calcul de plus-value (#23)`
- `fix(front): corrige l'affichage du signe sur une plus-value négative (#37)`

## Discipline de commit

- un commit correspond à une fonctionnalité ou une correction cohérente et complète, jamais un commit fourre-tout de fin de session
- commits réguliers au fil du travail, pas un seul gros commit par phase : un historique granulaire documente la progression, facilite la relecture et permet un retour arrière ciblé en cas de régression
- aucun commit directement sur `main` ou `dev` : le travail passe systématiquement par une branche `<type>/<numéro>-<slug>`, fusionnée dans `dev` par pull request relue ; `dev` n'est fusionnée dans `main` que pour une version validée. Les deux branches sont protégées, et les contrôles automatiques y sont exigés
- un commit qui casse le build ou les tests existants n'est pas acceptable, y compris en cours de journée
- les tests unitaires du back-end s'exécutent avec Vitest : `npm test` depuis `backend/`, ou `npm run test:watch` pendant le développement
