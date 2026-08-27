// Contrôleurs de la gestion du compte. Le propriétaire est toujours le porteur du
// jeton, jamais un identifiant reçu du client : aucune de ces routes n'accepte de
// paramètre désignant un utilisateur, il n'y a donc rien à contrôler de ce côté.

const serviceCompte = require('../services/compte');

async function changerMotDePasse(req, res, next) {
  try {
    await serviceCompte.changerMotDePasse({
      utilisateurId: req.utilisateur.id,
      ancienMotDePasse: req.body.ancienMotDePasse,
      nouveauMotDePasse: req.body.nouveauMotDePasse,
    });
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

async function supprimer(req, res, next) {
  try {
    await serviceCompte.supprimer({ utilisateurId: req.utilisateur.id });
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

// Marque d'ordre des octets. Sans elle, un tableur sous Windows ouvre le fichier dans
// l'encodage local et abîme les caractères accentués des noms de classe d'actif.
const BOM = '﻿';

// Seule route du back-end à ne pas répondre en JSON : elle produit un fichier, pas une
// ressource à consommer par l'interface.
async function exporterMouvements(req, res, next) {
  try {
    const { nomFichier, contenu } = await serviceCompte.exporterMouvements({
      utilisateurId: req.utilisateur.id,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    // Le nom du fichier est construit par le serveur à partir d'une date : il ne peut
    // porter aucun caractère saisi par l'utilisateur, et rien n'est à échapper ici.
    res.send(BOM + contenu);
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = { changerMotDePasse, supprimer, exporterMouvements };
