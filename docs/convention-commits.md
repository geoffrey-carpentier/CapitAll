# Convention de commits - CapitAll

Validée le 14/07/2026 (D19). Conventional Commits, messages en français (D13).

## Format

```
type(scope): description courte au présent, à la voix active, sans point final

corps optionnel, uniquement si le pourquoi n'est pas évident depuis le titre et le code
```

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

- `feat(back): ajoute le calcul du PRU moyen pondéré`
- `fix(back): corrige la vérification de propriété sur la suppression d'un actif`
- `feat(front): ajoute le formulaire d'ajout de transaction`
- `feat(db): ajoute les tables alerte et snapshot_valorisation`
- `docs: met à jour le README avec la procédure de déploiement`
- `chore(db): ajoute le script de seed`
- `test(back): ajoute les tests unitaires du calcul de plus-value`
- `fix(front): corrige l'affichage du signe sur une plus-value négative`

## Discipline de commit

- un commit correspond à une fonctionnalité ou une correction cohérente et complète, jamais un commit fourre-tout de fin de session
- commits réguliers au fil du travail, pas un seul gros commit par phase : le jury lit l'historique, un historique qui ne contient que 4 commits sur 4 semaines serait suspect
- pas de commit directement sur `main` : le travail passe par `dev` (ou une branche `feature/` pour une tâche non triviale isolable), fusion vers `main` en fin de phase validée
- un commit qui casse le build ou les tests existants n'est pas acceptable, y compris en cours de journée
