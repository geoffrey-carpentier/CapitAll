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
import {
  formaterCours,
  formaterMontant,
  symboleDevise,
  versNotationPositionnelle,
} from '../utils/formatage';
import { bornes, hauteurDeBascule } from '../utils/echelleCourbe';

// Évolution d'une valeur dans le temps, en aire dégradée (deux points au minimum,
// l'appelant affiche un message sinon).
//
// Le tracé porte role="img" et une description textuelle ; les valeurs restent aussi
// lisibles hors du graphe.
//
// La ligne de prix de revient est facultative (absente pour le patrimoine). Fournie,
// elle partage l'aire en deux teintes : gain au-dessus, perte en dessous.

// Graduation de l'axe : entier au-dessus de l'unité, chiffres significatifs en dessous,
// sans quoi un cours très faible donnerait un axe entièrement à « 0 ».
function graduation(valeur, symbole) {
  const texte = versNotationPositionnelle(valeur);

  if (Math.abs(Number(valeur)) >= 1) {
    return `${Math.round(valeur)}${symbole}`;
  }

  return formaterCours(texte, { symbole });
}

function decrire(points, devise, sujet, prixDeRevient) {
  if (points.length < 2) {
    return 'Évolution indisponible.';
  }

  const symbole = symboleDevise(devise);
  const debut = points[0];
  const fin = points[points.length - 1];

  const evolution =
    `Évolution ${sujet}, du ${debut.date} au ${fin.date}, ` +
    `de ${formaterMontant(debut.valeur, { symbole })} à ${formaterMontant(fin.valeur, { symbole })}.`;

  if (prixDeRevient === null) {
    return evolution;
  }

  // La description nomme la ligne de référence qui partage les deux teintes.
  return (
    `${evolution} Le prix de revient, ${formaterMontant(prixDeRevient, { symbole })}, ` +
    "est figuré par une ligne horizontale pointillée : l'aire est teintée en positif " +
    'au-dessus et en négatif en dessous.'
  );
}

export default function Courbe({
  points = [],
  devise = 'EUR',
  masque = false,
  sens = 'hausse',
  prixDeRevient = null,
  // Objet de la courbe, repris dans la description accessible.
  sujet = 'de la valeur du portefeuille',
  ...proprietes
}) {
  const symbole = symboleDevise(devise);

  // Identifiant unique : un dégradé dupliqué dans le document s'appliquerait aux deux
  // courbes d'un même écran.
  const identifiantDegrade = `degrade-courbe-${useId()}`;

  // Seule conversion en nombre, pour la géométrie du tracé : ces valeurs ne sont jamais
  // affichées, le texte passe par le module de formatage.
  const series = points.map((point) => ({
    date: point.date,
    hauteur: Number(point.valeur),
  }));

  // Le sens vient de la performance calculée par le serveur, pas d'une comparaison de
  // flottants.
  const teinte = sens === 'baisse' ? 'var(--couleur-negatif)' : 'var(--couleur-positif)';

  const seuil = prixDeRevient === null ? null : Number(prixDeRevient);
  const hauteurs = series.map((point) => point.hauteur);
  const bascule = hauteurDeBascule(hauteurs, seuil);
  const aireBicolore = bascule !== null;

  return (
    <div
      className="courbe"
      role="img"
      aria-label={
        masque
          ? `Évolution ${sujet}, montants masqués.`
          : decrire(points, devise, sujet, prixDeRevient)
      }
      {...proprietes}
    >
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={identifiantDegrade} x1="0" y1="0" x2="0" y2="1">
              {aireBicolore ? (
                <>
                  {/* Deux arrêts confondus : bascule franche sur la ligne pointillée. */}
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

          {/* Le masquage cache aussi l'échelle, qui trahirait l'ordre de grandeur. */}
          <YAxis
            width={masque ? 24 : 56}
            tick={masque ? false : { fill: 'var(--couleur-texte-attenue)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(valeur) => graduation(valeur, symbole)}
            // L'échelle englobe le prix de revient pour garder sa ligne dans le cadre.
            domain={aireBicolore ? bornes(hauteurs, seuil) : ['auto', 'auto']}
          />

          {aireBicolore && (
            <ReferenceLine
              y={seuil}
              stroke="var(--couleur-texte-attenue)"
              strokeDasharray="4 4"
              // Libellé chiffré de la ligne, masqué comme l'échelle.
              label={
                masque
                  ? undefined
                  : {
                      value: `Prix de revient ${formaterMontant(prixDeRevient, { symbole })}`,
                      // Dans la moitié basse du cadre, le libellé passe au-dessus du
                      // trait pour ne pas chevaucher les dates de l'axe.
                      position: bascule > 0.5 ? 'insideBottomLeft' : 'insideTopLeft',
                      fill: 'var(--couleur-texte-attenue)',
                      fontSize: 11,
                    }
              }
            />
          )}

          <Area
            type="monotone"
            dataKey="hauteur"
            // Le trait suit la même bascule de teinte que l'aire.
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
