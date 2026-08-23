import { useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import './Courbe.css';
import { formaterMontant, symboleDevise } from '../utils/formatage';
import { bornes, hauteurDeBascule } from '../utils/echelleCourbe';

// Évolution de la valeur dans le temps, en aire dégradée.
//
// Deux points au minimum. Une courbe à un seul point ne trace rien et donne à croire
// que l'application a perdu des données : c'est un message qui prend sa place, pas un
// point isolé.
//
// Le tracé porte un role="img" et une description en toutes lettres. Il n'est jamais la
// seule source de l'information : la valeur de départ et celle d'arrivée sont écrites
// sous le graphe, et la performance de la période l'accompagne dans le sélecteur.
//
// La ligne de prix de revient, pointillée, n'apparaît que sur le graphe d'une position :
// le tableau de bord ne la fournit pas, le patrimoine n'ayant pas de prix de revient
// unitaire. Le composant l'accepte donc sans l'exiger.
//
// Lorsqu'elle est fournie, l'aire se teinte de part et d'autre de cette ligne, en positif
// au-dessus et en négatif en dessous. C'est le geste graphique propre à l'application :
// il donne à voir d'un seul regard, sur toute la période, quand la position a été en
// gain et quand elle a été en perte. Une aire d'une seule teinte ne dirait que le solde
// du jour, et raterait l'essentiel du produit.

function decrire(points, devise) {
  if (points.length < 2) {
    return 'Évolution indisponible.';
  }

  const symbole = symboleDevise(devise);
  const debut = points[0];
  const fin = points[points.length - 1];

  return (
    `Évolution de la valeur du portefeuille, du ${debut.date} au ${fin.date}, ` +
    `de ${formaterMontant(debut.valeur, { symbole })} à ${formaterMontant(fin.valeur, { symbole })}.`
  );
}

export default function Courbe({
  points = [],
  devise = 'EUR',
  masque = false,
  sens = 'hausse',
  prixDeRevient = null,
  ...proprietes
}) {
  const symbole = symboleDevise(devise);

  // Deux courbes peuvent coexister sur un même écran. Un identifiant de dégradé fixe
  // serait alors dupliqué dans le document, et le navigateur appliquerait le premier
  // aux deux tracés.
  const identifiantDegrade = `degrade-courbe-${useId()}`;

  // Conversion numérique réservée à la géométrie du tracé : ces nombres donnent une
  // ordonnée en pixels et ne sont jamais affichés. Toute valeur lue par l'utilisateur
  // passe par le module de formatage, à partir de la chaîne d'origine.
  const series = points.map((point) => ({
    date: point.date,
    hauteur: Number(point.valeur),
  }));

  // Le sens de la période est fourni par l'appelant, qui le tire de la performance
  // renvoyée par le serveur. Le déduire ici en comparant deux montants convertis en
  // nombres ferait entrer un flottant dans une décision d'affichage, pour rien.
  const teinte = sens === 'baisse' ? 'var(--couleur-negatif)' : 'var(--couleur-positif)';

  const seuil = prixDeRevient === null ? null : Number(prixDeRevient);
  const hauteurs = series.map((point) => point.hauteur);
  const bascule = hauteurDeBascule(hauteurs, seuil);
  const aireBicolore = bascule !== null;

  return (
    <div
      className="courbe"
      role="img"
      aria-label={masque ? 'Évolution de la valeur du portefeuille, montants masqués.' : decrire(points, devise)}
      {...proprietes}
    >
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={identifiantDegrade} x1="0" y1="0" x2="0" y2="1">
              {aireBicolore ? (
                <>
                  {/* Deux arrêts confondus à la hauteur du prix de revient : la bascule
                      de teinte y est franche, exactement sur la ligne pointillée. */}
                  <stop offset={0} stopColor="var(--couleur-positif)" stopOpacity={0.35} />
                  <stop offset={bascule} stopColor="var(--couleur-positif)" stopOpacity={0.04} />
                  <stop offset={bascule} stopColor="var(--couleur-negatif)" stopOpacity={0.04} />
                  <stop offset={1} stopColor="var(--couleur-negatif)" stopOpacity={0.35} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={teinte} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={teinte} stopOpacity={0} />
                </>
              )}
            </linearGradient>
          </defs>

          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--couleur-texte-attenue)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />

          {/* Le masquage porte aussi sur l'axe : laisser l'échelle visible reviendrait
              à publier l'ordre de grandeur du patrimoine que l'on vient de cacher. */}
          <YAxis
            width={masque ? 24 : 56}
            tick={masque ? false : { fill: 'var(--couleur-texte-attenue)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(valeur) => `${Math.round(valeur)}${symbole}`}
            // L'échelle englobe le prix de revient : sans cela, une position toujours
            // en gain sortirait sa ligne de référence du cadre, et la bascule de teinte
            // n'aurait plus de sens visible.
            domain={aireBicolore ? bornes(hauteurs, seuil) : ['auto', 'auto']}
          />

          {aireBicolore && (
            <ReferenceLine y={seuil} stroke="var(--couleur-texte-attenue)" strokeDasharray="4 4" />
          )}

          <Area
            type="monotone"
            dataKey="hauteur"
            // Le trait suit la même bascule que l'aire : un trait vert traversant une
            // zone rouge se lirait comme une contradiction.
            stroke={aireBicolore ? `url(#${identifiantDegrade})` : teinte}
            strokeWidth={2}
            fill={`url(#${identifiantDegrade})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
