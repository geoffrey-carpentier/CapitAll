// Contrôleurs de la gestion du compte : le compte visé est toujours celui du porteur du
// jeton, aucune route n'accepte d'identifiant d'utilisateur.

const serviceCompte = require('../services/compte');

async function changerMotDePasse(req, res, next) {
  try {
    const { token } = await serviceCompte.changerMotDePasse({
      utilisateurId: req.utilisateur.id,
      ancienMotDePasse: req.body.ancienMotDePasse,
      nouveauMotDePasse: req.body.nouveauMotDePasse,
    });
    // 200 et non 204 : la réponse porte le jeton neuf qui garde la session courante
    // ouverte, les jetons antérieurs étant révoqués.
    res.status(200).json({ token });
  } catch (erreur) {
    next(erreur);
  }
}

async function supprimer(req, res, next) {
  try {
    await serviceCompte.supprimer({
      utilisateurId: req.utilisateur.id,
      motDePasse: req.body.motDePasse,
    });
    res.status(204).end();
  } catch (erreur) {
    next(erreur);
  }
}

// Marque d'ordre des octets (BOM), sans laquelle un tableur Windows lit le fichier dans
// l'encodage local et abîme les accents.
const BOM = '﻿';

// Seule route qui ne répond pas en JSON : elle produit un fichier.
async function exporterMouvements(req, res, next) {
  try {
    const { nomFichier, contenu } = await serviceCompte.exporterMouvements({
      utilisateurId: req.utilisateur.id,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    // Nom construit par le serveur à partir d'une date : rien à échapper.
    res.send(BOM + contenu);
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = { changerMotDePasse, supprimer, exporterMouvements };
