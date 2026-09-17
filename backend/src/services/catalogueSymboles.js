// Couverture des symboles acceptés, classe par classe, exposée à l'interface.
//
// Les classes ne se décrivent pas toutes par une liste : les cryptomonnaies (Coinbase)
// et les devises (taux BCE via Frankfurter) évoluent chez le fournisseur et ne sont pas
// figées dans le code. Chaque entrée porte sa provenance et sa date de constat.

const { SYMBOLES_ACTION_AUTORISES, ACTIONS_FMP } = require('../validation/actif');
const { SOURCE: SOURCE_COINBASE } = require('../adaptateurs/coinbase');
const { SOURCE: SOURCE_FRANKFURTER } = require('../adaptateurs/frankfurter');
const { SOURCE: SOURCE_METAL, UNITE: UNITE_METAL } = require('../adaptateurs/metal');

//   fermee   liste connue d'avance : l'interface propose un choix ;
//   ouverte  seul le fournisseur sait : contrôle au premier relevé de cours.
const COUVERTURE_FERMEE = 'fermee';
const COUVERTURE_OUVERTE = 'ouverte';

// Métaux dont la cotation a été constatée chez gold-api, en once troy. Ce n'est pas une
// restriction : le symbole n'est pas contrôlé à la saisie.
const SYMBOLES_METAL = [
  { symbole: 'XAU', nom: 'Or' },
  { symbole: 'XAG', nom: 'Argent' },
  { symbole: 'XPT', nom: 'Platine' },
  { symbole: 'XPD', nom: 'Palladium' },
];

// Suggestions : les cinquante premières capitalisations cotées en euros chez Coinbase au
// 06/09/2026 (TRX, STETH, BGB, XMR, OKB et KAS ne l'étaient pas). Toute autre
// cryptomonnaie cotée reste acceptée.
const SUGGESTIONS_CRYPTO = [
  'BTC', 'ETH', 'USDT', 'XRP', 'BNB', 'SOL', 'USDC', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'TON', 'SHIB', 'XLM', 'SUI', 'DOT', 'BCH', 'HBAR', 'LTC', 'PEPE',
  'UNI', 'NEAR', 'APT', 'ICP', 'AAVE', 'ETC', 'TAO', 'POL', 'VET', 'CRO',
  'ALGO', 'RENDER', 'FIL', 'ARB', 'ATOM', 'FET', 'OP', 'INJ', 'MKR', 'TIA',
  'STX', 'IMX', 'GRT', 'SEI',
];

function classes() {
  return [
    {
      type: 'crypto',
      couverture: COUVERTURE_OUVERTE,
      provenance: SOURCE_COINBASE,
      constate_le: '2026-09-06',
      controle: 'au premier relevé de cours',
      suggestions: SUGGESTIONS_CRYPTO.map((symbole) => ({ symbole })),
      note: "Toute cryptomonnaie cotée en euros par le fournisseur est acceptée. Les symboles proposés sont les quarante-quatre premières capitalisations dont le taux en euros a été relevé le 06/09/2026 ; six des cinquante premières n'y figurent pas, faute d'être cotées en euros.",
    },
    {
      type: 'devise',
      couverture: COUVERTURE_OUVERTE,
      provenance: SOURCE_FRANKFURTER,
      constate_le: '2026-07-09',
      controle: 'au premier relevé de cours',
      note: 'Les devises suivies par les taux de référence de la Banque centrale européenne.',
    },
    {
      type: 'metal',
      couverture: COUVERTURE_FERMEE,
      provenance: SOURCE_METAL,
      constate_le: '2026-09-06',
      controle: 'au premier relevé de cours',
      unite: UNITE_METAL,
      symboles: SYMBOLES_METAL,
      note: 'Cotation par once troy. Le contrôle reste au relevé : ces quatre symboles sont ceux dont la cotation a été constatée, non une restriction imposée par l’application.',
    },
    {
      type: 'action',
      couverture: COUVERTURE_FERMEE,
      provenance: 'Financial Modeling Prep (plan gratuit), Finnhub en repli',
      constate_le: '2026-09-06',
      controle: 'à la saisie',
      // Seule liste opposable : la validation refuse tout symbole absent.
      symboles: [...SYMBOLES_ACTION_AUTORISES].sort().map((symbole) => ({
        symbole,
        // Les deux fournisseurs n'ont pas le même quota : un cours peut manquer sur l'un.
        provenance: ACTIONS_FMP.includes(symbole) ? 'fmp' : 'finnhub',
      })),
      note: "La liste des actions disponibles est contrôlée côté serveur. Un symbole absent est refusé à la saisie. Les quatre-vingt-six premiers sont servis par le plan gratuit de FMP, les vingt suivants par Finnhub, dont le quota quotidien est plus étroit.",
    },
  ];
}

function obtenirCatalogue() {
  return { classes: classes() };
}

module.exports = {
  obtenirCatalogue,
  COUVERTURE_FERMEE,
  COUVERTURE_OUVERTE,
  SYMBOLES_METAL,
  SUGGESTIONS_CRYPTO,
};
