// Schémas de validation des actifs (D41).
// Ni utilisateur_id ni id ne figurent dans ces schémas : le propriétaire vient du jeton
// et l'identifiant de l'URL. .strict() rejette donc toute tentative de les fournir
// dans le corps de la requête.

const { z } = require('zod');

// Les quatre types du CHECK de la table actif, ni plus ni moins.
const TYPES_ACTIF = ['crypto', 'devise', 'metal', 'action'];

const LONGUEUR_MAXIMALE_SYMBOLE = 20;
const LONGUEUR_MAXIMALE_NOM = 100;

// Liste fermée actée en D27 et vérifiée sur le plan gratuit FMP. Le contrôle a lieu
// avant toute écriture et tout appel fournisseur ; les autres classes conservent leurs
// symboles propres.
const SYMBOLES_ACTION_AUTORISES = new Set([
  'AAPL', 'TSLA', 'AMZN', 'MSFT', 'NVDA', 'GOOGL', 'META', 'NFLX', 'JPM', 'V',
  'BAC', 'PYPL', 'DIS', 'T', 'PFE', 'COST', 'INTC', 'KO', 'TGT', 'NKE', 'SPY',
  'BA', 'BABA', 'XOM', 'WMT', 'GE', 'CSCO', 'VZ', 'JNJ', 'CVX', 'PLTR', 'SQ',
  'SHOP', 'SBUX', 'SOFI', 'HOOD', 'RBLX', 'SNAP', 'AMD', 'UBER', 'FDX', 'ABBV',
  'ETSY', 'MRNA', 'LMT', 'GM', 'F', 'LCID', 'CCL', 'DAL', 'UAL', 'AAL', 'TSM',
  'SONY', 'ET', 'MRO', 'COIN', 'RIVN', 'RIOT', 'CPRX', 'VWO', 'SPYG', 'NOK',
  'ROKU', 'VIAC', 'ATVI', 'BIDU', 'DOCU', 'ZM', 'PINS', 'TLRY', 'WBA', 'MGM',
  'NIO', 'C', 'GS', 'WFC', 'ADBE', 'PEP', 'UNH', 'CARR', 'HCA', 'TWTR', 'BILI',
  'SIRI', 'FUBO', 'RKT',
]);

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
};
