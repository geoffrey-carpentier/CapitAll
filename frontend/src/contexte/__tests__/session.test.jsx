import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FournisseurAuthentification } from '../Authentification';
import { useAuthentification } from '../contexteAuthentification';
import { api } from '../../services/api';
import { CLE_SESSION } from '../../utils/preferences';

// Session durable (révision de D57).
//
// D57 gardait le jeton dans le seul état React : recharger déconnectait. Ce que ces
// tests protègent, c'est la révision **et sa limite** : la session survit au
// rechargement, elle ne survit pas à la fermeture de l'onglet. Le jour où quelqu'un
// remplacera sessionStorage par localStorage pour « faire mieux », c'est ici que la
// différence se verra.

const SESSION = {
  token: 'jeton-de-test',
  utilisateur: { id: 1, email: 'camille@exemple.test', pseudo: 'Camille', role: 'utilisateur' },
};

function Temoin() {
  const { jeton, utilisateur, estConnecte, connecter, deconnecter, remplacerJeton } =
    useAuthentification();

  return (
    <div>
      <p>jeton : {jeton ?? 'aucun'}</p>
      <p>pseudo : {utilisateur?.pseudo ?? 'aucun'}</p>
      <p>connecté : {String(estConnecte)}</p>
      <button type="button" onClick={() => connecter({ email: 'x', motDePasse: 'y' })}>
        Se connecter
      </button>
      <button type="button" onClick={() => remplacerJeton('jeton-renouvele')}>
        Renouveler
      </button>
      <button type="button" onClick={deconnecter}>
        Se déconnecter
      </button>
    </div>
  );
}

// Chaque rendu est un chargement de page : le fournisseur relit le stockage à son
// montage, exactement comme au rafraîchissement.
function monter() {
  return render(
    <FournisseurAuthentification>
      <Temoin />
    </FournisseurAuthentification>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.spyOn(api, 'connexion').mockResolvedValue(SESSION);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('session durable', () => {
  it('part sans session quand le stockage est vide', () => {
    monter();
    expect(screen.getByText('connecté : false')).toBeTruthy();
  });

  it('retrouve la session après un rechargement', async () => {
    const utilisateur = userEvent.setup();
    monter();

    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText('connecté : true');

    // Le rechargement : on démonte tout et on remonte le fournisseur à neuf.
    cleanup();
    monter();

    expect(screen.getByText('connecté : true')).toBeTruthy();
    expect(screen.getByText('jeton : jeton-de-test')).toBeTruthy();
    expect(screen.getByText('pseudo : Camille')).toBeTruthy();
  });

  it('écrit dans le stockage de session, jamais dans le stockage local', async () => {
    const utilisateur = userEvent.setup();
    monter();

    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText('connecté : true');

    // La distinction est tout l'objet de la révision : le stockage de session disparaît
    // à la fermeture de l'onglet, le stockage local reste sur le poste.
    expect(window.sessionStorage.getItem(CLE_SESSION)).toContain('jeton-de-test');
    expect(window.localStorage.length).toBe(0);
  });

  it('efface la session à la déconnexion', async () => {
    const utilisateur = userEvent.setup();
    monter();

    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText('connecté : true');
    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(screen.getByText('connecté : false')).toBeTruthy();
    expect(window.sessionStorage.getItem(CLE_SESSION)).toBeNull();
  });

  it('retient le jeton renouvelé après un changement de mot de passe', async () => {
    const utilisateur = userEvent.setup();
    monter();

    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText('connecté : true');
    await utilisateur.click(screen.getByRole('button', { name: 'Renouveler' }));

    await waitFor(() => {
      expect(screen.getByText('jeton : jeton-renouvele')).toBeTruthy();
    });
    // Le jeton neuf survit au rechargement, sans quoi le changement de mot de passe
    // déconnecterait à la première navigation.
    expect(window.sessionStorage.getItem(CLE_SESSION)).toContain('jeton-renouvele');
    // Le reste de la session n'est pas perdu au passage.
    expect(screen.getByText('pseudo : Camille')).toBeTruthy();
  });

  it('repart sans session sur un stockage illisible', () => {
    // Écriture partielle, format changé entre deux versions : mieux vaut redemander une
    // connexion que de partir avec un état à moitié reconstitué.
    window.sessionStorage.setItem(CLE_SESSION, '{ceci nest pas du json');

    monter();

    expect(screen.getByText('connecté : false')).toBeTruthy();
    expect(window.sessionStorage.getItem(CLE_SESSION)).toBeNull();
  });

  it('ignore une session enregistrée sans jeton', () => {
    window.sessionStorage.setItem(CLE_SESSION, JSON.stringify({ utilisateur: { pseudo: 'X' } }));

    monter();

    expect(screen.getByText('connecté : false')).toBeTruthy();
  });
});
