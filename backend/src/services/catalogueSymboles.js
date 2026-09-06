// Couverture des symboles par classe d'actif (D27, précisée en L3).
//
// D27 a acté une liste fermée d'actions, et l'interface n'en a jamais rien su : le champ
// symbole est une saisie libre, et l'utilisateur découvrait le refus après avoir tapé.
// Ce module expose ce que l'application accepte réellement, classe par classe.
//
// La question posée à D27 n'est pas « quelle est la liste » mais « quelle est la
// couverture » : les quatre classes ne se décrivent pas de la même façon. Deux ont une
// liste énumérable, deux n'en ont pas — Coinbase cote des milliers de paires et
// Frankfurter suit les taux de référence de la Banque centrale européenne, deux
// ensembles qui changent sans prévenir. Prétendre les figer dans le code produirait une
// liste fausse le jour où le fournisseur en ajoute un.
//
// Chaque entrée porte donc sa provenance et la date à laquelle elle a été constatée.
// Une liste sans date est une liste dont personne ne peut dire si elle est encore vraie.

const { SYMBOLES_ACTION_AUTORISES, ACTIONS_FMP } = require('../validation/actif');
const { SOURCE: SOURCE_COINBASE } = require('../adaptateurs/coinbase');
const { SOURCE: SOURCE_FRANKFURTER } = require('../adaptateurs/frankfurter');
const { SOURCE: SOURCE_METAL, UNITE: UNITE_METAL } = require('../adaptateurs/metal');

// Deux couvertures, et la différence porte à conséquence pour l'interface.
//
//   fermee   la liste est connue d'avance, le refus arrive à la saisie, sans appel
//            réseau, et l'interface peut proposer un choix plutôt qu'un champ libre ;
//   ouverte  seul le fournisseur sait, le contrôle a donc lieu au premier relevé de
//            cours, et l'interface annonce d'où viendra la réponse.
const COUVERTURE_FERMEE = 'fermee';
const COUVERTURE_OUVERTE = 'ouverte';

// Les métaux ne sont pas contrôlés à la saisie : gold-api reçoit le symbole tel quel.
// Ces quatre-là sont ceux dont la cotation a été constatée, pas une liste imposée. Le
// platine et le palladium ont été ajoutés le 06/09/2026, après relevé effectif de leur
// cours chez le même fournisseur, dans la même unité que l'or et l'argent.
const SYMBOLES_METAL = [
  { symbole: 'XAU', nom: 'Or' },
  { symbole: 'XAG', nom: 'Argent' },
  { symbole: 'XPT', nom: 'Platine' },
  { symbole: 'XPD', nom: 'Palladium' },
];

// Couverture ouverte ne veut pas dire couverture inconnue. Ces quarante-quatre
// cryptomonnaies sont celles du classement des cinquante premières capitalisations dont
// Coinbase publiait effectivement un taux en euros au relevé du 06/09/2026. Ce n'est pas
// une restriction — toute autre cryptomonnaie cotée reste acceptée — mais de quoi
// proposer un choix plutôt qu'un champ vide.
//
// Six manquaient à ce relevé, faute d'être cotées en euros chez ce fournisseur : TRX,
// STETH, BGB, XMR, OKB et KAS.
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
      // Seule classe dont la liste est **opposable** : la validation refuse tout symbole
      // absent, avant écriture et avant tout appel fournisseur.
      symboles: [...SYMBOLES_ACTION_AUTORISES].sort().map((symbole) => ({
        symbole,
        // Dire quel fournisseur répondra n'est pas un détail d'implémentation : les deux
        // n'ont pas le même quota, et c'est ce qui explique qu'un cours puisse manquer
        // sur l'un et pas sur l'autre.
        provenance: ACTIONS_FMP.includes(symbole) ? 'fmp' : 'finnhub',
      })),
      note: "Liste fermée actée en D27 et étendue en D99. Un symbole absent est refusé à la saisie. Les quatre-vingt-six premiers sont servis par le plan gratuit de FMP, les vingt suivants par Finnhub, dont le quota quotidien est plus étroit.",
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
