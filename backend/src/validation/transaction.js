// Schémas de validation des transactions (D41).
//
// Les montants et les quantités ne sont jamais convertis en nombre à virgule flottante :
// ils sont normalisés en chaîne de caractères et transmis tels quels aux colonnes NUMERIC
// de PostgreSQL (D4). Convertir en Number ferait perdre de la précision sur des quantités
// à 8 décimales, ce qui est exactement ce que le choix de NUMERIC vise à éviter.

const { z } = require('zod');

const SENS_TRANSACTION = ['achat', 'vente'];

const DECIMALES_QUANTITE = 8;
const DECIMALES_PRIX = 2;
const LONGUEUR_MAXIMALE_NOTE = 500;

// Accepte un nombre ou une chaîne, et rend toujours une chaîne : la valeur d'origine
// est préservée au caractère près.
function nombreDecimal({ decimalesMax, strictementPositif }) {
  const motif = new RegExp(`^\\d+(\\.\\d{1,${decimalesMax}})?$`);

  return z
    .union([z.string(), z.number()])
    .transform((valeur) => String(valeur).trim())
    .refine((valeur) => motif.test(valeur), {
      message: `La valeur doit être positive et comporter au plus ${decimalesMax} décimales.`,
    })
    .refine((valeur) => !strictementPositif || Number(valeur) > 0, {
      message: 'La valeur doit être strictement positive.',
    });
}

const dateTransaction = z
  .string()
  .trim()
  .refine((valeur) => !Number.isNaN(Date.parse(valeur)), {
    message: 'La date de transaction est invalide.',
  })
  // Une transaction ne peut pas être enregistrée avant d'avoir eu lieu.
  .refine((valeur) => Date.parse(valeur) <= Date.now(), {
    message: 'La date de transaction ne peut pas être dans le futur.',
  });

// actif_id est absent du schéma : il vient de l'URL, contrôlé contre le propriétaire.
const creationTransaction = z
  .object({
    sens: z.enum(SENS_TRANSACTION, 'Le sens doit valoir achat ou vente.'),
    quantite: nombreDecimal({ decimalesMax: DECIMALES_QUANTITE, strictementPositif: true }),
    prix_unitaire: nombreDecimal({ decimalesMax: DECIMALES_PRIX, strictementPositif: false }),
    frais: nombreDecimal({ decimalesMax: DECIMALES_PRIX, strictementPositif: false }).default('0'),
    date_transaction: dateTransaction,
    note: z.string().trim().max(LONGUEUR_MAXIMALE_NOTE).optional(),
  })
  .strict();

module.exports = { creationTransaction, SENS_TRANSACTION };
