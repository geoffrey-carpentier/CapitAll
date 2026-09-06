# Convention de commits - CapitAll

Validée le 14/07/2026 (D19), étendue le 24/07/2026 (D39) avec la référence d'issue et le workflow de branches, puis le 29/07/2026 (D47) avec la granularité par lot fonctionnel. Conventional Commits, messages en français (D13).

## Format

```
type(scope): description courte au présent, à la voix active, sans point final (#X)

corps optionnel, uniquement si le pourquoi n'est pas évident depuis le titre et le code
```

`(#X)` référence l'issue GitHub traitée par le commit ; `X` est son numéro.

## Branches

Une branche par **lot fonctionnel cohérent** (D47), créée depuis `dev` : `feature/<numéro>-<slug>` (fonctionnalité) ou `fix/<numéro>-<slug>` (correction), slug court en minuscules séparé par des tirets — par exemple `feature/9-authentification`. Le numéro est celui de l'issue principale du lot.

À l'intérieur du lot, chaque issue garde son commit, avec son suffixe `(#X)` : l'historique reste granulaire, seule la fréquence des branches et des pull requests diminue. Un lot regroupe des travaux qui n'ont pas d'intérêt à être livrés séparément, comme la chaîne d'authentification (configuration, inscription, connexion, middlewares).

La branche se ferme par une pull request vers `dev` (jamais vers `main`), dont la description liste toutes les issues du lot avec le mot-clé `Closes #X`. Ce mot-clé ne ferme toutefois l'issue automatiquement qu'à la fusion dans la branche par défaut (`main`) : les pull requests étant fusionnées dans `dev`, chaque issue se ferme manuellement après le merge.

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
- aucun commit directement sur `main` ou `dev` (D39) : le travail passe systématiquement par une branche `feature/<numéro>-<slug>` ou `fix/<numéro>-<slug>`, fusionnée dans `dev` via pull request revue ; `dev` est fusionnée dans `main` en fin de phase validée
- un commit qui casse le build ou les tests existants n'est pas acceptable, y compris en cours de journée
- les tests unitaires du back-end s'exécutent avec Vitest (D48) : `npm test` depuis `backend/`, ou `npm run test:watch` pendant le développement
