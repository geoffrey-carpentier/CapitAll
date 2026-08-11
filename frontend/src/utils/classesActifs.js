// Nom d'affichage de chaque classe d'actif.
//
// Vit hors des composants pour deux raisons. La première tient à l'outillage : un
// module qui exporte à la fois un composant et une constante empêche le rechargement à
// chaud de fonctionner. La seconde est plus durable : ces libellés apparaissent dans le
// jeton de classe, dans la légende de répartition et dans les filtres de la liste des
// positions, et deux tables de libellés finiraient par diverger.
//
// Le vocabulaire est celui du lexique du projet, il ne s'invente pas ici.
export const LIBELLES_CLASSE = {
  crypto: 'Cryptomonnaie',
  metal: 'Métal précieux',
  devise: 'Devise',
  action: 'Action',
};
