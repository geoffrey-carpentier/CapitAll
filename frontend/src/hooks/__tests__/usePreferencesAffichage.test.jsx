import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePreferencesAffichage } from '../usePreferencesAffichage';
import { CLE_DEVISE, CLE_MASQUAGE } from '../../utils/preferences';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePreferencesAffichage', () => {
  it('part de l euro et des montants visibles quand rien n est mémorisé', () => {
    const { result } = renderHook(() => usePreferencesAffichage());

    expect(result.current.devise).toBe('EUR');
    expect(result.current.masque).toBe(false);
  });

  it('reprend les réglages déjà mémorisés au montage', () => {
    window.sessionStorage.setItem(CLE_DEVISE, 'USD');
    window.sessionStorage.setItem(CLE_MASQUAGE, 'oui');

    const { result } = renderHook(() => usePreferencesAffichage());

    expect(result.current.devise).toBe('USD');
    expect(result.current.masque).toBe(true);
  });

  it('mémorise la devise choisie', () => {
    const { result } = renderHook(() => usePreferencesAffichage());

    act(() => result.current.choisirDevise('USD'));

    expect(result.current.devise).toBe('USD');
    expect(window.sessionStorage.getItem(CLE_DEVISE)).toBe('USD');
  });

  it('mémorise le masquage sous la forme oui ou non', () => {
    const { result } = renderHook(() => usePreferencesAffichage());

    act(() => result.current.choisirMasquage(true));

    expect(result.current.masque).toBe(true);
    expect(window.sessionStorage.getItem(CLE_MASQUAGE)).toBe('oui');

    act(() => result.current.choisirMasquage(false));

    expect(result.current.masque).toBe(false);
    expect(window.sessionStorage.getItem(CLE_MASQUAGE)).toBe('non');
  });

  it('retombe sur les valeurs par défaut si la lecture du stockage échoue', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('stockage refusé');
    });

    const { result } = renderHook(() => usePreferencesAffichage());

    expect(result.current.devise).toBe('EUR');
    expect(result.current.masque).toBe(false);
  });

  // Navigation privée stricte : l'écriture est refusée, mais l'écran doit tout de même
  // suivre le choix de l'utilisateur pendant sa visite.
  it('applique le choix même si l écriture est refusée', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('stockage refusé');
    });

    const { result } = renderHook(() => usePreferencesAffichage());

    act(() => result.current.choisirDevise('USD'));
    act(() => result.current.choisirMasquage(true));

    expect(result.current.devise).toBe('USD');
    expect(result.current.masque).toBe(true);
  });
});
