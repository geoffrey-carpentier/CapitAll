# Politique de formatage des nombres

Règles d'affichage des valeurs numériques dans l'interface de CapitAll. Ce document est la référence unique : toute valeur affichée passe par l'une des six catégories ci-dessous, sans exception locale.

Le besoin est particulier à l'application : quatre classes d'actifs qui ne se mesurent pas de la même façon cohabitent sur un même écran. Une cryptomonnaie se compte en unités à huit décimales, un métal en grammes, une action en titres entiers, une devise en unités monétaires. Une règle unique produirait soit des colonnes illisibles, soit des arrondis faux.

## Principe fondateur

Les montants sont stockés en `NUMERIC` et transitent par l'API sous forme de **chaînes de caractères**, jamais de nombres flottants. Le formatage respecte cette contrainte : il opère par manipulation de la chaîne décimale, pas par conversion en `Number`.

Concrètement, on découpe sur le séparateur décimal, on tronque ou on complète la partie décimale, on retire les zéros de fin, puis on insère les séparateurs de milliers. `parseFloat` n'est utilisé nulle part dans la chaîne d'affichage d'un montant.

Ce choix a un coût, une trentaine de lignes de code, et deux bénéfices. Il rend impossible l'introduction d'une erreur de représentation en virgule flottante, y compris sur les quantités à huit décimales où `Number` finit par mentir. Et il tient la promesse posée à la conception : aucun montant n'est jamais converti en flottant, pas même pour être affiché.

## Conventions communes

- **Locale française** : virgule décimale, espace insécable fine comme séparateur de milliers (`12 480,65`), symbole après la valeur avec espace insécable (`12 480,65 €`).
- **Chiffres tabulaires** (`font-variant-numeric: tabular-nums`) sur toute valeur numérique, pour que les colonnes s'alignent verticalement.
- **Zéros de fin toujours supprimés**, dans les six catégories. `20,00 €` s'écrit `20 €`, `0,60000000 BTC` s'écrit `0,6 BTC`.
- **Jamais de troncature silencieuse d'une valeur significative.** Si une valeur ne tient pas dans le format prévu, on élargit le format, on ne rogne pas le chiffre.

## 1. Montants en devise fiduciaire

Valorisations, coûts d'acquisition, montants d'opération, plus-values, totaux.

**Deux décimales maximum, zéros de fin supprimés.**

| Valeur reçue | Affichage |
|---|---|
| `20.00` | `20 €` |
| `20.50` | `20,5 €` |
| `20.25` | `20,25 €` |
| `12480.6500` | `12 480,65 €` |
| `0.004` | `0,01 €` (arrondi au centime supérieur en valeur absolue) |

*Motivation.* Le centime est la plus petite unité qui ait un sens pour un patrimoine. Afficher `20,00 €` alourdit la lecture sans rien apporter ; les décimales portent de l'information seulement quand elles ne sont pas nulles.

*Cas limite.* Une valeur non nulle inférieure à un centime ne s'affiche jamais `0 €`, ce qui laisserait croire à une absence de valeur. Elle s'affiche `0,01 €` avec une infobulle donnant la valeur exacte.

## 2. Quantités d'actifs

Le nombre d'unités détenues. Le format dépend de la classe.

| Classe | Décimales maximum | Unité affichée | Exemple |
|---|---|---|---|
| Cryptomonnaie | 8 | symbole | `0,6 BTC`, `0,60000001 BTC` |
| Métal précieux | 3 | `g` | `18 g`, `620,5 g` |
| Devise | 2 | code ISO | `1 500 USD` |
| Action | 6 | `titre` / `titres` | `12 titres`, `0,5 titre` |

**Zéros de fin supprimés dans tous les cas.**

| Valeur reçue | Affichage |
|---|---|
| `0.60000000` | `0,6` |
| `15.00000000` | `15` |
| `0.60000010` | `0,6000001` |
| `0.60000001` | `0,60000001` |

*Motivation.* La précision d'une quantité est une donnée, pas une décoration : elle résulte d'un achat réel et l'arrondir fausserait la vérification manuelle du calcul par l'utilisateur. Mais afficher huit décimales quand six sont nulles produit une colonne illisible. Supprimer les zéros de fin conserve l'exactitude et rend la lecture possible.

*Sur l'unité affichée.* L'unité n'est jamais omise ni convertie. Un gramme d'or reste un gramme, il n'est pas ramené à une once ni à un pourcentage. Cette hétérogénéité assumée est un parti pris de l'application : elle donne à voir la nature réelle de chaque position.

*Accord en nombre.* `1 titre`, `2 titres`. Le pluriel ne s'applique qu'aux unités nommées en français, jamais aux symboles ni aux codes ISO (`1 BTC` et non `1 BTCs`).

## 3. Cours unitaires

Le prix d'une unité d'actif, et le prix de revient unitaire.

**Précision significative variable selon l'ordre de grandeur, zéros de fin supprimés.**

| Ordre de grandeur | Décimales maximum | Exemple |
|---|---|---|
| ≥ 1 000 | 2 | `61 240 €`, `54 890,12 €` |
| ≥ 10 et < 1 000 | 2 | `92,14 €`, `249,61 €` |
| ≥ 0,01 et < 10 | 4 | `1,1523 €`, `0,9152 €` |
| < 0,01 | 6 | `0,000842 €` |

*Motivation.* C'est le point où une règle unique à deux décimales échoue. Le gramme d'argent vaut environ `1,1523 €` : arrondi à `1,15`, l'erreur atteint 0,2 % sur une valorisation, soit un écart visible entre le cours affiché et le total affiché. L'utilisateur qui refait le calcul à la main ne retrouve pas ses chiffres, et la confiance tombe. La règle par ordre de grandeur conserve toujours quatre chiffres significatifs au minimum.

*Cohérence avec le total.* Le total affiché est toujours calculé à partir de la valeur exacte, jamais à partir de la valeur arrondie affichée. Le formatage est une couche de présentation, il n'entre jamais dans un calcul.

## 4. Taux de change

Le taux euro-dollar de la bascule d'affichage.

**Quatre décimales, zéros de fin supprimés.** `1 € = 1,0926 $`.

*Motivation.* Même raisonnement qu'au point 3, poussé plus loin : un taux de change s'exprime conventionnellement à quatre décimales dans tous les usages financiers, et deux décimales le rendraient inutilisable. La règle est fixe et ne dépend pas de l'ordre de grandeur, l'usage étant établi.

*Affichage de la source.* Un taux est toujours accompagné de son horodatage lorsqu'il est utilisé pour convertir un affichage, jamais présenté comme une vérité intemporelle.

## 5. Pourcentages

Répartition du portefeuille, part d'une classe, progression vers un seuil.

**Une décimale maximum, zéros de fin supprimés, symbole avec espace insécable.**

| Valeur | Affichage |
|---|---|
| `46.0` | `46 %` |
| `46.04` | `46 %` |
| `46.15` | `46,2 %` |
| `0.04` | `< 0,1 %` |

*Motivation.* La deuxième décimale d'une répartition n'a aucune valeur décisionnelle et alourdit une légende qui compte déjà quatre à six lignes. Le seuil bas `< 0,1 %` évite d'afficher `0 %` pour une position qui existe.

*Somme des parts.* Les parts arrondies peuvent ne pas totaliser exactement 100 %. On n'ajuste jamais artificiellement une part pour forcer le total : on n'affiche simplement pas de ligne de total dans la légende de répartition.

## 6. Variations, absolues et relatives

La performance d'une position ou du portefeuille.

**Variation relative** : une décimale maximum, zéros de fin supprimés, signe explicite toujours présent. `+11,6 %`, `−6,5 %`, `0 %`.

**Variation absolue** : règle des montants fiduciaires, signe explicite toujours présent. `+393,71 €`, `−135,51 €`.

**Le signe est obligatoire**, y compris au positif. Le moins est le signe typographique `−` (U+2212) et non le trait d'union, pour l'alignement en chiffres tabulaires.

*Traitement graduel selon l'amplitude.* Le poids visuel d'une variation suit son amplitude, ce qui évite qu'une page entière crie d'une seule voix.

| Amplitude | Traitement |
|---|---|
| ≥ 10 % | pastille pleine colorée, flèche, signe |
| ≥ 1 % et < 10 % | texte coloré, flèche, signe, sans pastille |
| < 1 % | texte atténué, signe, sans couleur ni flèche |
| exactement 0 | texte atténué, `0 %`, sans signe ni flèche |

*Accessibilité, règle non négociable.* Une variation n'est **jamais** portée par la couleur seule. Le signe et la flèche (`▲` `▼`) sont toujours présents, ce qui rend l'information lisible en niveaux de gris et par un utilisateur daltonien. C'est une exigence du référentiel d'accessibilité, et c'est ce qui justifie que la troisième ligne du tableau ci-dessus conserve le signe alors qu'elle abandonne la couleur.

## Mise en œuvre

Module unique `frontend/src/utils/formatage.js`, sans dépendance externe :

```
formaterMontant(chaine)                  → catégorie 1
formaterQuantite(chaine, typeActif)      → catégorie 2
formaterCours(chaine)                    → catégorie 3
formaterTaux(chaine)                     → catégorie 4
formaterPourcentage(chaine)              → catégorie 5
formaterVariation(chaine, mode)          → catégorie 6, mode 'absolue' ou 'relative'
```

Aucun composant ne formate un nombre par lui-même. Toute valeur numérique affichée dans l'interface provient de l'une de ces six fonctions, ce qui rend la politique vérifiable par une simple recherche dans le code.

Les fonctions sont couvertes par des tests unitaires portant explicitement sur les cas limites listés dans ce document : zéros de fin, valeur nulle, valeur inférieure au seuil d'affichage, changement d'ordre de grandeur, signe des variations.
