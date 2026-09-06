// Schémas de validation des actifs (D41).
// Ni utilisateur_id ni id ne figurent dans ces schémas : le propriétaire vient du jeton
// et l'identifiant de l'URL. .strict() rejette donc toute tentative de les fournir
// dans le corps de la requête.

const { z } = require('zod');

// Les quatre types du CHECK de la table actif, ni plus ni moins.
const TYPES_ACTIF = ['crypto', 'devise', 'metal', 'action'];

const LONGUEUR_MAXIMALE_SYMBOLE = 20;
const LONGUEUR_MAXIMALE_NOM = 100;

// Liste fermée actée en D27, étendue le 06/09/2026 (D99). Le contrôle a lieu avant toute
// écriture et avant tout appel fournisseur ; les autres classes conservent leurs symboles
// propres.
//
// Deux origines, et la distinction porte à conséquence sur les quotas.

// Ce que sert le plan gratuit de FMP, source principale de la chaîne : 250 appels par
// jour. Hors de cette liste, FMP répond « not available under your current subscription »,
// quel que soit le symbole. Constatée le 06/09/2026.
const ACTIONS_FMP = [
  'AAPL', 'TSLA', 'AMZN', 'MSFT', 'NVDA', 'GOOGL', 'META', 'NFLX', 'JPM', 'V',
  'BAC', 'PYPL', 'DIS', 'T', 'PFE', 'COST', 'INTC', 'KO', 'TGT', 'NKE', 'SPY',
  'BA', 'BABA', 'XOM', 'WMT', 'GE', 'CSCO', 'VZ', 'JNJ', 'CVX', 'PLTR', 'SQ',
  'SHOP', 'SBUX', 'SOFI', 'HOOD', 'RBLX', 'SNAP', 'AMD', 'UBER', 'FDX', 'ABBV',
  'ETSY', 'MRNA', 'LMT', 'GM', 'F', 'LCID', 'CCL', 'DAL', 'UAL', 'AAL', 'TSM',
  'SONY', 'ET', 'MRO', 'COIN', 'RIVN', 'RIOT', 'CPRX', 'VWO', 'SPYG', 'NOK',
  'ROKU', 'VIAC', 'ATVI', 'BIDU', 'DOCU', 'ZM', 'PINS', 'TLRY', 'WBA', 'MGM',
  'NIO', 'C', 'GS', 'WFC', 'ADBE', 'PEP', 'UNH', 'CARR', 'HCA', 'BILI',
  'SIRI', 'FUBO', 'RKT',
];

// TWTR a été retiré de la liste d'origine : FMP le cote encore, mais sous le nom
// « Twitter, Inc. (delisted) » et à un prix figé depuis le retrait de la cote en 2022.
// Un cours qui ne bouge plus n'est pas un cours ; le laisser proposer aurait donné à
// suivre une position dont la valorisation aurait été fausse par construction.
//
// VIAC, ATVI et SQ sont conservés bien que leurs sociétés aient changé de nom ou été
// absorbées : FMP les cote toujours et le prix suit, ce que le contrôle du 06/09/2026 a
// vérifié. Leur libellé peut surprendre, la valorisation reste juste.

// Grandes capitalisations américaines absentes du plan gratuit de FMP, servies par
// Finnhub, deuxième maillon de la chaîne. Vérifiées une à une le 06/09/2026.
//
// Le repli a un coût : pour ces symboles, FMP est interrogé d'abord et refuse, ce qui
// consomme un appel sur les 250 quotidiens avant que Finnhub ne réponde. Et Finnhub n'en
// accorde que 30 par jour. C'est pourquoi la liste reste courte et se limite aux valeurs
// qu'un particulier détient réellement : le cache de cours absorbe le reste.
const ACTIONS_FINNHUB = [
  'LLY', 'AVGO', 'ORCL', 'MA', 'HD', 'PG', 'MRK', 'CRM', 'TMO', 'ACN',
  'MCD', 'CAT', 'IBM', 'QCOM', 'TXN', 'ISRG', 'BKNG', 'AXP', 'RTX', 'HON',
];

const SYMBOLES_ACTION_AUTORISES = new Set([...ACTIONS_FMP, ...ACTIONS_FINNHUB]);

const symbole = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Le symbole est obligatoire.')
  .max(LONGUEUR_MAXIMALE_SYMBOLE, `Le symbole ne peut pas dépasser ${LONGUEUR_MAXIMALE_SYMBOLE} caractères.`)
  .regex(/^[A-Z0-9]+$/, 'Le symbole ne peut contenir que des lettres et des chiffres.');

const nom = z
  .string()
  .trim()
  .min(1, 'Le nom est obligatoire.')
  .max(LONGUEUR_MAXIMALE_NOM, `Le nom ne peut pas dépasser ${LONGUEUR_MAXIMALE_NOM} caractères.`);

const creationActif = z
  .object({
    type: z.enum(TYPES_ACTIF, "Le type doit valoir crypto, devise, metal ou action."),
    symbole,
    nom,
  })
  .strict()
  .superRefine((actif, contexte) => {
    if (actif.type === 'action' && !SYMBOLES_ACTION_AUTORISES.has(actif.symbole)) {
      contexte.addIssue({
        code: 'custom',
        path: ['symbole'],
        message: "Cette action ne fait pas partie de la liste autorisée.",
      });
    }
  });

// Seul le nom est modifiable : changer le symbole ou le type d'un actif déjà porteur
// de transactions rendrait son historique incohérent.
const modificationActif = z.object({ nom }).strict();

module.exports = {
  creationActif,
  modificationActif,
  TYPES_ACTIF,
  SYMBOLES_ACTION_AUTORISES,
  ACTIONS_FMP,
  ACTIONS_FINNHUB,
};
