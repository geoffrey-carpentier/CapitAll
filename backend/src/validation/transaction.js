// Schémas de validation des transactions. Montants et quantités ne passent jamais par
// un flottant : ils sont normalisés en chaîne et transmis tels quels aux colonnes NUMERIC.

const { z } = require('zod');
const { versNotationPositionnelle } = require('../utils/decimal');

// Trois natures de mouvement. La sortie non marchande couvre le retrait et le
// transfert : la quantité quitte la position sans contrepartie en euros.
const SENS_TRANSACTION = ['achat', 'vente', 'sortie_non_marchande'];

const UNITE_EURO = 'EUR';

// Décimales admises, alignées sur les échelles de calcul.
const DECIMALES_QUANTITE = 18;
const DECIMALES_PRIX = 18;
const DECIMALES_FRAIS = 2;
// Les frais prélevés dans un actif se comptent comme une quantité, pas comme un montant :
// 0,000021 ETH est un prélèvement courant, que deux décimales ramèneraient à zéro.
const DECIMALES_FRAIS_MONTANT = 18;

// Bornes hautes, exprimées en nombre de chiffres avant la virgule.
//
// Elles garantissent que le produit quantité × prix tienne dans sa colonne : une valeur
// trop grande est refusée à la saisie plutôt que par PostgreSQL en erreur serveur.
const CHIFFRES_QUANTITE = 12;
const CHIFFRES_PRIX = 9;
const CHIFFRES_FRAIS = 9;

const LONGUEUR_MAXIMALE_NOTE = 500;

// Accepte un nombre ou une chaîne, et rend toujours une chaîne.
//
// La notation scientifique est ramenée en écriture positionnelle avant tout contrôle.
// JSON.parse rend un nombre, et JavaScript écrit spontanément en exposant tout nombre
// inférieur à 1e-6 : un prix légitime de 0,0000001 arrivait sous la forme « 1e-7 », que
// le motif aurait rejeté comme malformé. Le cas ne se posait pas tant que deux décimales
// suffisaient ; il se pose à dix-huit.
function nombreDecimal({ decimalesMax, chiffresEntiersMax, strictementPositif }) {
  const motif = new RegExp(`^\\d{1,${chiffresEntiersMax}}(\\.\\d{1,${decimalesMax}})?$`);

  return z
    .union([z.string(), z.number()])
    .transform((valeur) => versNotationPositionnelle(String(valeur).trim()))
    .refine((valeur) => motif.test(valeur), {
      message:
        `La valeur doit être positive, comporter au plus ${decimalesMax} décimales ` +
        `et ${chiffresEntiersMax} chiffres avant la virgule.`,
    })
    // Strictement positif se lit sur les chiffres, sans conversion : passer par Number
    // ferait rentrer le flottant que tout le reste de la chaîne tient à l'écart.
    .refine((valeur) => !strictementPositif || /[1-9]/.test(valeur), {
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

// Unité de prélèvement des frais : l'euro, ou le symbole d'un actif. Le contrôle porte
// ici sur la forme seule ; savoir si ce symbole est celui de l'actif échangé ou celui
// d'un tiers demande de connaître l'actif, que l'URL porte et que le service lit.
const uniteFrais = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "L'unité des frais est obligatoire.")
  .max(20, "L'unité des frais ne peut pas dépasser 20 caractères.")
  .regex(/^[A-Z0-9]+$/, "L'unité des frais ne peut contenir que des lettres et des chiffres.");

// actif_id est absent du schéma : il vient de l'URL, contrôlé contre le propriétaire.
const creationTransaction = z
  .object({
    sens: z.enum(SENS_TRANSACTION, 'Le sens doit valoir achat, vente ou sortie non marchande.'),
    quantite: nombreDecimal({
      decimalesMax: DECIMALES_QUANTITE,
      chiffresEntiersMax: CHIFFRES_QUANTITE,
      strictementPositif: true,
    }),
    // Facultatif dans le schéma, obligatoire dans les faits pour un achat ou une vente :
    // la règle dépend du sens, elle est donc portée par le contrôle croisé plus bas.
    prix_unitaire: nombreDecimal({
      decimalesMax: DECIMALES_PRIX,
      chiffresEntiersMax: CHIFFRES_PRIX,
      strictementPositif: false,
    }).optional(),
    // Frais réglés en euros : la forme courte.
    frais: nombreDecimal({
      decimalesMax: DECIMALES_FRAIS,
      chiffresEntiersMax: CHIFFRES_FRAIS,
      strictementPositif: false,
    }).optional(),
    // Forme longue : ce qui a réellement été prélevé, et en quoi.
    frais_montant: nombreDecimal({
      decimalesMax: DECIMALES_FRAIS_MONTANT,
      chiffresEntiersMax: CHIFFRES_FRAIS,
      strictementPositif: false,
    }).optional(),
    frais_unite: uniteFrais.optional(),
    // Contre-valeur en euros, demandée explicitement lorsque les frais sont prélevés
    // dans un actif que l'opération n'échange pas : aucun taux n'est alors déductible
    // du mouvement, et le deviner reviendrait à inventer un chiffre.
    frais_contre_valeur_eur: nombreDecimal({
      decimalesMax: DECIMALES_FRAIS,
      chiffresEntiersMax: CHIFFRES_FRAIS,
      strictementPositif: false,
    }).optional(),
    date_transaction: dateTransaction,
    note: z.string().trim().max(LONGUEUR_MAXIMALE_NOTE).optional(),
  })
  .strict()
  .superRefine((mouvement, contexte) => {
    const refuser = (champ, message) =>
      contexte.addIssue({ code: 'custom', path: [champ], message });

    const sortie = mouvement.sens === 'sortie_non_marchande';

    // Le prix suit le sens. Une sortie non marchande ne dégage aucun produit : lui
    // donner un prix, c'est exactement ce qui la ferait passer pour une vente.
    if (!sortie && mouvement.prix_unitaire === undefined) {
      refuser('prix_unitaire', 'Le prix unitaire est obligatoire.');
    }

    if (sortie && mouvement.prix_unitaire !== undefined && /[1-9]/.test(mouvement.prix_unitaire)) {
      refuser(
        'prix_unitaire',
        "Une sortie non marchande n'a pas de prix : elle ne dégage aucun produit."
      );
    }

    // Les deux formes disent la même chose lorsque l'unité est l'euro, et se
    // contredisent sinon. Accepter les deux obligerait à décider laquelle prime.
    if (mouvement.frais !== undefined && mouvement.frais_montant !== undefined) {
      refuser(
        'frais_montant',
        'Indiquez les frais une seule fois : en euros, ou dans leur unité de prélèvement.'
      );
    }

    if (mouvement.frais_unite !== undefined && mouvement.frais_montant === undefined) {
      refuser('frais_montant', 'Indiquez le montant des frais prélevés dans cette unité.');
    }

    // Des frais annoncés en euros doivent tenir dans la colonne des euros, qui se règle
    // au centime. Sans ce contrôle, 0,005 euro serait accepté ici puis arrondi à
    // l'enregistrement, et les deux colonnes de frais cesseraient de coïncider : la
    // contrainte de cohérence rendrait une erreur serveur là où un refus de saisie est
    // la bonne réponse.
    if (
      mouvement.frais_unite === UNITE_EURO &&
      mouvement.frais_montant !== undefined &&
      (mouvement.frais_montant.split('.')[1] ?? '').length > DECIMALES_FRAIS
    ) {
      refuser(
        'frais_montant',
        `Des frais en euros comportent au plus ${DECIMALES_FRAIS} décimales.`
      );
    }

    if (mouvement.frais_contre_valeur_eur !== undefined) {
      if (mouvement.frais_unite === undefined) {
        refuser(
          'frais_unite',
          "La contre-valeur en euros n'a de sens qu'avec l'unité des frais prélevés."
        );
      } else if (mouvement.frais_unite === UNITE_EURO) {
        refuser(
          'frais_contre_valeur_eur',
          'Des frais réglés en euros sont déjà leur propre contre-valeur.'
        );
      }
    }
  });

module.exports = { creationTransaction, SENS_TRANSACTION, UNITE_EURO };
