import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Coquille from '../Coquille';
import * as contexte from '../../contexte/contexteAuthentification';

// Barre de navigation et bouton flottant de saisie.
//
// Le bouton renvoyait toujours au Patrimoine : depuis l'écran des seuils ou la liste des
// positions, enregistrer un mouvement faisait perdre l'écran qu'on consultait, son filtre
// et son tri. Il ouvre désormais la saisie sur place.
//
// Ce que ces tests protègent aussi, c'est ce qu'il ne fait pas : il porte la même action
// partout. La tentation était d'en faire « + Seuil » sur l'écran des seuils ; un même
// bouton, au même endroit, faisant deux choses selon la page se découvre par erreur.

function Temoin() {
  const { pathname, search } = useLocation();
  return <p>adresse : {pathname + search}</p>;
}

function rendre(adresse) {
  vi.spyOn(contexte, 'useAuthentification').mockReturnValue({
    utilisateur: { pseudo: 'Camille' },
    deconnecter: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <Routes>
        <Route element={<Coquille />}>
          <Route path="/patrimoine" element={<Temoin />} />
          <Route path="/positions" element={<Temoin />} />
          <Route path="/positions/:id" element={<Temoin />} />
          <Route path="/seuils" element={<Temoin />} />
          <Route path="/compte" element={<Temoin />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('bouton de saisie de la barre mobile', () => {
  it('ouvre la saisie sans quitter l’écran des seuils', async () => {
    const utilisateur = userEvent.setup();
    rendre('/seuils?tri=ecart');

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));

    // Le chemin ne change pas, et les paramètres déjà posés survivent : c'est
    // exactement ce que la navigation vers le Patrimoine faisait perdre.
    expect(screen.getByText('adresse : /seuils?tri=ecart&mouvement=nouveau')).toBeTruthy();
  });

  it('ouvre la saisie sur place depuis la liste des positions', async () => {
    const utilisateur = userEvent.setup();
    rendre('/positions?classes=crypto');

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));

    expect(screen.getByText('adresse : /positions?classes=crypto&mouvement=nouveau')).toBeTruthy();
  });

  it('vaut aussi pour le détail d’une position', async () => {
    const utilisateur = userEvent.setup();
    rendre('/positions/12');

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau mouvement' }));

    expect(screen.getByText('adresse : /positions/12?mouvement=nouveau')).toBeTruthy();
  });

  it('reste une navigation, visible, sur un écran qui n’héberge pas la feuille', () => {
    // L'écran Compte n'affiche aucune position. Plutôt qu'un bouton sans effet, un lien,
    // que l'utilisateur peut reconnaître comme tel avant de cliquer.
    rendre('/compte');

    const lien = screen.getByRole('link', { name: 'Nouveau mouvement' });
    expect(lien.getAttribute('href')).toBe('/patrimoine?mouvement=nouveau');
    expect(screen.queryByRole('button', { name: 'Nouveau mouvement' })).toBeNull();
  });

  it('porte partout la même action', () => {
    for (const adresse of ['/patrimoine', '/positions', '/seuils', '/compte']) {
      cleanup();
      rendre(adresse);
      expect(screen.getByText('Nouveau mouvement')).toBeTruthy();
      // Aucune variante d'intitulé selon l'écran.
      expect(screen.queryByText(/Nouveau seuil/)).toBeNull();
    }
  });

  it('garde son rang dans la barre, déclaré et non déduit d’un index', () => {
    rendre('/patrimoine');

    // Le bouton était inséré sur `index === 2` dans la boucle de rendu : réordonner la
    // barre l'aurait déplacé sans que rien ne le signale.
    const entrees = screen
      .getAllByRole('listitem')
      .map((element) => element.textContent.replace('+', '').trim());

    expect(entrees).toEqual([
      'Patrimoine',
      'Positions',
      'Nouveau mouvement',
      'Seuils',
      'Compte',
    ]);
  });
});
