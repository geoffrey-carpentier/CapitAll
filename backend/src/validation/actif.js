// Schémas de validation des actifs. utilisateur_id et id n'y figurent pas : ils viennent
// du jeton et de l'URL, et .strict() refuse de les recevoir dans le corps.

const { z } = require('zod');

// Les quatre types du CHECK de la table actif, ni plus ni moins.
const TYPES_ACTIF = ['crypto', 'devise', 'metal', 'action'];

const LONGUEUR_MAXIMALE_SYMBOLE = 20;
const LONGUEUR_MAXIMALE_NOM = 100;

// Liste fermée des actions, contrôlée avant toute écriture et tout appel fournisseur.
// Deux origines, qui n'ont pas les mêmes quotas.

// Symboles servis par le plan gratuit de FMP (250 appels par jour), constatés le
// 06/09/2026 ; hors de cette liste, FMP refuse la requête.
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

// TWTR est exclu : FMP le cote encore, mais à un prix figé depuis son retrait de la
// cote. VIAC, ATVI et SQ restent : FMP les cotait toujours avec un prix vivant au
// contrôle du 06/09/2026.

// Grandes capitalisations absentes du plan gratuit de FMP, servies par Finnhub et
// vérifiées le 06/09/2026. Liste volontairement courte : FMP est interrogé d'abord
// (un appel consommé) et Finnhub est limité à 30 appels par jour.
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

// Seul le nom est modifiable : changer symbole ou type rendrait l'historique incohérent.
const modificationActif = z.object({ nom }).strict();

module.exports = {
  creationActif,
  modificationActif,
  TYPES_ACTIF,
  SYMBOLES_ACTION_AUTORISES,
  ACTIONS_FMP,
  ACTIONS_FINNHUB,
};
