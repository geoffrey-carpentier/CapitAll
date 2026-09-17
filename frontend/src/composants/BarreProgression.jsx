import './BarreProgression.css';
import Montant from './Montant';
import { formaterPourcentage } from '../utils/formatage';

// Avancement d'une valeur vers un seuil, accompagné des deux montants écrits.
//
// Seule la largeur de la barre passe par un nombre : c'est de la géométrie, aucune
// valeur lue n'est un flottant. Pour la même raison, l'échelle ARIA va de 0 à 100 et
// non en euros ; aria-valuetext porte le texte annoncé.
//
// L'écart restant (« reste 6 % ») est écrit dans la barre ; l'avancement est porté par
// sa longueur. La couleur est celle de la classe d'actif surveillée.
//
// Sans cours, la barre est remplacée par une mention : une barre vide se lirait « loin
// du seuil ». Le masquage remplace les montants par des points, pas le pourcentage.

// La barre est pleine au franchissement. Pour un seuil bas, le rapport est inversé :
// sinon un seuil bas très éloigné afficherait une barre pleine.
function fraction(valeur, cible, sens) {
  const cours = Number(valeur);
  const seuil = Number(cible);

  if (!Number.isFinite(cours) || !Number.isFinite(seuil) || cours <= 0 || seuil <= 0) {
    return null;
  }

  const rapport = sens === 'en_dessous' ? seuil / cours : cours / seuil;
  return Math.min(Math.max(rapport, 0), 1);
}

export default function BarreProgression({
  valeur,
  cible,
  devise = 'EUR',
  libelle,
  sens = 'au_dessus',
  atteint = false,
  masque = false,
  classe = null,
  ecart = null,
}) {
  const avancement =
    valeur === null || valeur === undefined ? null : fraction(valeur, cible, sens);

  if (avancement === null) {
    return (
      <p className="barre-progression__indisponible">
        Cours indisponible : la progression vers ce seuil n'est pas calculable.
      </p>
    );
  }

  const pourcentage = Math.round(avancement * 100);
  const description = sens === 'au_dessus' ? 'seuil haut' : 'seuil bas';

  // Sous 22 %, le remplissage est trop court : l'étiquette se pose juste après lui.
  const dansLeRemplissage = pourcentage >= 22;
  const etiquette = ecart === null || ecart === undefined ? null : `reste ${formaterPourcentage(ecart)}`;

  return (
    <div className="barre-progression">
      <div
        className={[
          'barre-progression__piste',
          atteint ? 'barre-progression__piste--atteint' : '',
          classe ? `barre-progression__piste--${classe}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcentage}
        aria-valuetext={`${pourcentage} % du ${description}`}
        aria-label={libelle}
      >
        <span className="barre-progression__remplissage" style={{ width: `${pourcentage}%` }}>
          {etiquette && dansLeRemplissage && (
            <span className="barre-progression__pourcentage">{etiquette}</span>
          )}
        </span>
        {etiquette && !dansLeRemplissage && (
          <span
            className="barre-progression__pourcentage barre-progression__pourcentage--dehors"
            style={{ left: `${pourcentage}%` }}
          >
            {etiquette}
          </span>
        )}
      </div>
      <p className="barre-progression__reperes">
        {masque ? (
          <span aria-label="Montant masqué">••••</span>
        ) : (
          <Montant valeur={valeur} devise={devise} taille="legende" />
        )}
        <span className="barre-progression__cible">
          <span aria-hidden="true">/</span>
          <span className="lecteur-ecran-seulement">sur un seuil de</span>
          {masque ? (
            <span aria-label="Montant masqué">••••</span>
          ) : (
            <Montant valeur={cible} devise={devise} taille="legende" />
          )}
        </span>
      </p>
    </div>
  );
}
