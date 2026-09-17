import { describe, it, expect } from 'vitest';
import { classifierErreurApi } from '../erreurs';
import { ErreurApi } from '../../services/api';

describe('classifierErreurApi', () => {
  it('traite une erreur étrangère au client comme une erreur serveur', () => {
    expect(classifierErreurApi(new TypeError('fetch a échoué'))).toBe('api');
  });

  it('reconnaît une absence de réponse au statut 0', () => {
    expect(classifierErreurApi(new ErreurApi('Serveur injoignable', 0))).toBe('reseau');
  });

  it('reconnaît une session expirée sur un 401', () => {
    expect(classifierErreurApi(new ErreurApi('Jeton expiré', 401))).toBe('session');
  });

  it('laisse un refus de validation dans la catégorie serveur', () => {
    expect(classifierErreurApi(new ErreurApi('Quantité invalide', 400))).toBe('api');
  });

  it('range une panne serveur dans la catégorie serveur', () => {
    expect(classifierErreurApi(new ErreurApi('Indisponible', 503))).toBe('api');
  });
});
