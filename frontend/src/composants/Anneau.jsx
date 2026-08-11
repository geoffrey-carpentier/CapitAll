import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './Anneau.css';
import Montant from './Montant';
import JetonClasse from './JetonClasse';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import { formaterPourcentage } from '../utils/formatage';

// Répartition du patrimoine par classe d'actif.
//
// Le graphique n'est pas la donnée : la légende chiffrée l'est. Elle nomme chaque
// classe, donne son montant et sa part, et suffit à tout comprendre sans voir l'anneau.
// Celui-ci porte donc un role="img" et une description en toutes lettres, et rien n'y
// est accessible uniquement par la couleur : chaque entrée de légende porte son jeton
// de forme, son libellé et ses deux valeurs.
//
// L'anneau disparaît lorsqu'il ne reste qu'un segment : un disque plein annonçant
// « 100 % » n'informe personne, et occuper un tiers d'écran pour cela serait un gâchis.

// Les teintes ne portent aucune information : elles séparent les segments, et le jeton
// de forme de la légende reste le repère qui survit au niveau de gris.
const TEINTES = ['#4C9AFF', '#34C77B', '#9AA7B4', '#F0564F'];

function decrire(repartition) {
  const parts = repartition.map(
    ({ type, pourcentage }) => `${LIBELLES_CLASSE[type] ?? type} ${formaterPourcentage(pourcentage)}`
  );

  return `Répartition du patrimoine par classe d'actif : ${parts.join(', ')}.`;
}

export default function Anneau({ repartition = [], devise = 'EUR', masque = false }) {
  // Une répartition à un seul segment n'informe pas : la légende suffit.
  const afficherLAnneau = repartition.length > 1;

  return (
    <div className="anneau">
      {afficherLAnneau && (
        <div className="anneau__graphe" role="img" aria-label={decrire(repartition)}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                // Seule conversion numérique de l'écran, et elle ne produit aucune
                // valeur affichée : elle donne l'angle d'un segment en pixels. Tout ce
                // que l'utilisateur lit vient des chaînes, via le module de formatage.
                data={repartition.map((part) => ({
                  ...part,
                  angle: Number(part.pourcentage),
                }))}
                dataKey="angle"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {repartition.map((part, index) => (
                  <Cell key={part.type} fill={TEINTES[index % TEINTES.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="anneau__legende">
        {repartition.map((part, index) => (
          <li key={part.type} className="anneau__entree">
            <span
              className="anneau__teinte"
              style={{ backgroundColor: TEINTES[index % TEINTES.length] }}
              aria-hidden="true"
            />
            <JetonClasse classe={part.type} />
            <span className="anneau__nom">{LIBELLES[part.type] ?? part.type}</span>
            <span className="anneau__part">{formaterPourcentage(part.pourcentage)}</span>
            <span className="anneau__valeur">
              {masque ? (
                <span aria-label="Montant masqué">••••</span>
              ) : (
                <Montant valeur={part.valeur} devise={devise} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
