import './BarreProgression.css';
import Montant from './Montant';
import { formaterPourcentage } from '../utils/formatage';

// Avancement d'une valeur vers un seuil.
//
// La barre répond à une seule question, celle que pose la spécification devant chaque
// ligne de seuil : suis-je proche ? Elle ne remplace jamais les chiffres, elle les
// accompagne — les deux montants sont écrits à côté d'elle, mis en forme par le module
// de formatage comme partout ailleurs.
//
// La seule conversion numérique est celle de la fraction, qui donne une largeur en
// pourcentage. C'est de la géométrie, au même titre que l'ordonnée d'un point de
// courbe : rien de ce qui est lu par l'utilisateur ne passe par un nombre flottant.
//
// L'échelle ARIA est volontairement normalisée de 0 à 100 plutôt que calée sur les
// montants réels. Un aria-valuenow exprimé en euros supposerait de faire traverser un
// montant par un nombre pour une valeur restituée à la voix, ce que la politique de
// formatage interdit. aria-valuetext porte les deux montants en toutes lettres, et
// c'est lui que les lecteurs d'écran annoncent.
//
// L'écart restant avant franchissement est écrit dans la barre, à l'extrémité de son
// remplissage. Il figurait auparavant dans le texte au-dessus, ce qui séparait le chiffre
// de la forme qui le représente et obligeait à faire l'aller-retour. C'est bien l'écart
// que la spécification demande, et non l'avancement : dire « il reste 6 % » répond à la
// question posée devant un seuil, là où « vous en êtes à 94 % » la contourne. L'avancement
// reste porté par la longueur de la barre et par aria-valuenow. La barre porte la couleur de la
// classe d'actif surveillée, celle-là même que porte l'anneau de répartition (D98) : c'est
// le seul repère qui relie un seuil à ce qu'il surveille sans le répéter en toutes lettres.
//
// Un cours indisponible ne donne pas une barre à zéro, qui se lirait comme « très
// loin du seuil » : la barre disparaît au profit d'une mention explicite.
//
// Le masquage des montants, préférence globale de l'application, remplace les deux
// repères par des points plutôt que de les taire : la barre continue de dire à quelle
// distance on se trouve, sans jamais révéler le chiffre. Le pourcentage qu'annonce
// aria-valuetext n'est pas masqué, aucun pourcentage ne l'étant ailleurs dans
// l'application.
// La barre dit toujours la même chose : à quelle distance du déclenchement on se
// trouve, pleine au moment du franchissement. Un seuil bas se lit donc à l'envers d'un
// seuil haut — s'en éloigner, pour lui, c'est monter. Rapporter les deux au même
// rapport ferait qu'un seuil bas très éloigné afficherait une barre pleine.
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

  // Le pourcentage se lit dans la barre plutôt qu'au-dessus d'elle. Il y perd sa place
  // quand la barre est trop courte pour l'accueillir : en deçà d'un cinquième, il se pose
  // juste après le remplissage, sur la piste vide.
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
