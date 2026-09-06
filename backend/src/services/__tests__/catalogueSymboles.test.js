import { describe, it, expect } from 'vitest';
import { obtenirCatalogue, COUVERTURE_FERMEE, COUVERTURE_OUVERTE } from '../catalogueSymboles.js';
import { SYMBOLES_ACTION_AUTORISES } from '../../validation/actif.js';

// Couverture des symboles (D27, précisée en L3).
//
// L'enjeu de ces tests n'est pas le contenu des listes mais leur accord avec ce que
// l'application fait réellement. Un catalogue qui annoncerait une action absente de la
// validation, ou l'inverse, serait pire que pas de catalogue du tout : il promettrait un
// symbole que la saisie refuse.

function classe(type) {
  return obtenirCatalogue().classes.find((entree) => entree.type === type);
}

describe('catalogue des symboles', () => {
  it('décrit les quatre classes du modèle, et rien d’autre', () => {
    const types = obtenirCatalogue().classes.map((entree) => entree.type);
    expect(types).toEqual(['crypto', 'devise', 'metal', 'action']);
  });

  it('énumère exactement la liste que la validation oppose', () => {
    // C'est le seul contrôle qui compte vraiment : la liste annoncée et la liste
    // appliquée sont la même, par construction et non par recopie.
    const annonces = classe('action').symboles.map((entree) => entree.symbole);

    expect(annonces).toHaveLength(SYMBOLES_ACTION_AUTORISES.size);
    expect(new Set(annonces)).toEqual(SYMBOLES_ACTION_AUTORISES);
  });

  it('rend la liste des actions triée, pour que l’interface n’ait pas à le faire', () => {
    const annonces = classe('action').symboles.map((entree) => entree.symbole);
    expect(annonces).toEqual([...annonces].sort());
  });

  it('distingue une couverture fermée d’une couverture ouverte', () => {
    // Crypto et devise ne sont pas énumérables : Coinbase cote des milliers de paires
    // et la liste des devises de référence change sans prévenir. Prétendre les figer
    // produirait une liste fausse au premier ajout du fournisseur.
    expect(classe('crypto').couverture).toBe(COUVERTURE_OUVERTE);
    expect(classe('devise').couverture).toBe(COUVERTURE_OUVERTE);
    expect(classe('crypto').symboles).toBeUndefined();
    expect(classe('devise').symboles).toBeUndefined();

    expect(classe('action').couverture).toBe(COUVERTURE_FERMEE);
    expect(classe('metal').couverture).toBe(COUVERTURE_FERMEE);
  });

  it('dit où le contrôle a lieu, ce qui n’est pas le même moment selon la classe', () => {
    // Une liste fermée et opposable refuse à la saisie ; partout ailleurs, seul le
    // fournisseur peut répondre, et le refus arrive au premier relevé de cours.
    expect(classe('action').controle).toBe('à la saisie');
    expect(classe('crypto').controle).toBe('au premier relevé de cours');
    expect(classe('metal').controle).toBe('au premier relevé de cours');
  });

  it('accompagne chaque couverture de sa provenance et de sa date', () => {
    for (const entree of obtenirCatalogue().classes) {
      expect(entree.provenance).toBeTruthy();
      // Une liste sans date est une liste dont personne ne peut dire si elle est encore
      // vraie : la date est aussi obligatoire que la source.
      expect(entree.constate_le).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entree.constate_le))).toBe(false);
    }
  });

  it('rappelle l’unité de cotation des métaux', () => {
    // Le libellé « g » a fait mentir l'affichage d'un facteur 31 (D88) : l'unité voyage
    // désormais avec la classe, elle n'est plus une constante d'interface.
    expect(classe('metal').unite).toBe('once troy');
    expect(classe('metal').symboles.map((entree) => entree.symbole)).toEqual(['XAU', 'XAG']);
  });

  it('ne dépend d’aucun appel fournisseur', async () => {
    // Le catalogue décrit ce que l'application accepte ; il n'interroge pas les
    // cotations. Une panne de fournisseur ne doit pas rendre le formulaire inutilisable.
    const avant = obtenirCatalogue();
    const apres = obtenirCatalogue();
    expect(apres).toEqual(avant);
  });
});
