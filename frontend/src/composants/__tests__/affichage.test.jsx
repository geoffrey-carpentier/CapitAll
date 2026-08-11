import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Montant from '../Montant';
import Variation from '../Variation';
import JetonClasse from '../JetonClasse';
import PastilleFraicheur from '../PastilleFraicheur';

afterEach(cleanup);

const NBSP = ' '; // espace insécable, devant le symbole
const FINE = ' '; // espace fine insécable, séparateur de milliers

describe('Montant', () => {
  it('délègue la mise en forme au module de formatage', () => {
    const { container } = render(<Montant valeur="12480.6500" />);
    expect(container.textContent).toBe(`12${FINE}480,65${NBSP}€`);
  });

  it('applique le format propre à chaque type', () => {
    const { container } = render(
      <>
        <Montant valeur="0.60000000" type="quantite" classe="crypto" symbole="BTC" />
        <Montant valeur="1.1523" type="cours" />
        <Montant valeur="1.0926" type="taux" />
        <Montant valeur="46.04" type="pourcentage" />
      </>
    );
    expect(container.textContent).toBe(`0,6${NBSP}BTC1,1523${NBSP}€1,092646${NBSP}%`);
  });

  // Une donnée absente et une valeur nulle ne se confondent pas : sur un patrimoine,
  // afficher « 0 € » pour un cours manquant serait une information fausse.
  it("distingue l'absence de donnée d'un zéro", () => {
    const { container } = render(<Montant valeur={null} />);
    expect(container.textContent).toContain('—');
    expect(screen.getByText('valeur indisponible')).toBeTruthy();
  });
});

describe('Variation', () => {
  it('impose le signe, y compris au positif', () => {
    const { container } = render(<Variation valeur="11.6" />);
    expect(container.textContent).toContain(`+11,6${NBSP}%`);
  });

  // Règle non négociable de la politique de formatage : jamais la couleur seule.
  it('accompagne toute variation notable d\'une flèche, en plus du signe', () => {
    const { container } = render(<Variation valeur="-11.6" />);
    expect(container.textContent).toContain('▼');
    expect(container.textContent).toContain(`−11,6${NBSP}%`);
  });

  it('gradue le poids visuel selon les trois seuils d\'amplitude', () => {
    const { container } = render(
      <>
        <Variation valeur="11.6" data-cas="forte" />
        <Variation valeur="6.5" data-cas="moyenne" />
        <Variation valeur="0.4" data-cas="faible" />
        <Variation valeur="0" data-cas="nulle" />
      </>
    );
    const niveau = (cas) => container.querySelector(`[data-cas="${cas}"]`).className;
    expect(niveau('forte')).toContain('variation--forte');
    expect(niveau('moyenne')).toContain('variation--moyenne');
    expect(niveau('faible')).toContain('variation--faible');
    expect(niveau('nulle')).toContain('variation--nulle');
  });

  it('abandonne la flèche sous un pour cent, mais jamais le signe', () => {
    const { container } = render(<Variation valeur="0.4" />);
    expect(container.textContent).not.toContain('▲');
    expect(container.textContent).toContain(`+0,4${NBSP}%`);
  });

  it('n\'affiche aucun signe pour une variation exactement nulle', () => {
    const { container } = render(<Variation valeur="0" />);
    expect(container.textContent).toBe(`0${NBSP}%`);
  });

  // En mode absolu la valeur affichée est un montant : l'amplitude relative, que
  // l'appelant possède, sert à choisir le niveau. Sans elle, pas de pastille pleine.
  it('gradue le mode absolu sur l\'amplitude relative fournie', () => {
    const { container } = render(
      <>
        <Variation valeur="393.71" mode="absolue" amplitude="11.6" data-cas="fournie" />
        <Variation valeur="393.71" mode="absolue" data-cas="absente" />
      </>
    );
    expect(container.querySelector('[data-cas="fournie"]').className).toContain('variation--forte');
    expect(container.querySelector('[data-cas="absente"]').className).toContain('variation--faible');
    expect(container.querySelector('[data-cas="absente"]').textContent).toContain(
      `+393,71${NBSP}€`
    );
  });

  // La recherche par libellé normalise les espaces : l'insécable du libellé réel y est
  // ramenée à une espace ordinaire, l'attente s'écrit donc sans NBSP.
  it('énonce le sens en toutes lettres pour les lecteurs d\'écran', () => {
    render(<Variation valeur="-6.5" />);
    expect(screen.getByLabelText('en baisse de 6,5 %')).toBeTruthy();
  });
});

describe('JetonClasse', () => {
  it('porte une forme distincte par classe', () => {
    const { container } = render(
      <>
        <JetonClasse classe="crypto" />
        <JetonClasse classe="metal" />
        <JetonClasse classe="devise" />
        <JetonClasse classe="action" />
      </>
    );
    const formes = [...container.querySelectorAll('.jeton-classe__forme')].map((n) => n.className);
    expect(new Set(formes).size).toBe(4);
  });

  // La forme ne se prononce pas : le nom de la classe est toujours restitué.
  it('nomme la classe même lorsque le libellé n\'est pas visible', () => {
    render(<JetonClasse classe="metal" />);
    expect(screen.getByText('Métal précieux')).toBeTruthy();
  });

  it('ignore une classe inconnue plutôt que d\'afficher une forme muette', () => {
    const { container } = render(<JetonClasse classe="obligation" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('PastilleFraicheur', () => {
  const ilYaDixMinutes = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  it('annonce la source et l\'ancienneté du cours', () => {
    render(<PastilleFraicheur source="CoinGecko" horodatage={ilYaDixMinutes} />);
    expect(screen.getByLabelText('Cours à jour, source CoinGecko, il y a 10 min')).toBeTruthy();
  });

  // L'état de repli change de marque en plus de changer de teinte : il reste
  // identifiable en niveaux de gris.
  it('distingue le repli autrement que par la couleur', () => {
    const { container } = render(
      <PastilleFraicheur source="CoinGecko" horodatage={ilYaDixMinutes} enRepli />
    );
    expect(container.querySelector('.pastille-fraicheur--tiede')).toBeTruthy();
    expect(container.textContent).toContain('◐');
    expect(screen.getByLabelText(/Dernier cours connu/)).toBeTruthy();
  });
});
