import './FriseMouvements.css';
import Montant from './Montant';
import Variation from './Variation';
import { comparerDecimales } from '../utils/formatage';

// Chronologie des mouvements d'une position.
//
// Une frise et non un tableau, et ce n'est pas un choix décoratif : un mouvement n'est
// pas une ligne de données mais un événement daté qui déplace le prix de revient. La
// frise donne à lire cette causalité dans l'ordre où elle s'est produite.
//
// L'effet sur le prix de revient est le chiffre le plus difficile à défendre à l'oral,
// et c'est aussi celui que l'interface ne calcule pas : il arrive tel quel du serveur,
// qui détient le moteur et l'a produit en rejouant toute l'histoire de la position.
//
// Liste ordonnée sémantique, conformément à la spécification : la chronologie fait
// partie de l'information, elle ne doit pas reposer sur la seule disposition visuelle.

const LIBELLES_SENS = { achat: 'Achat', vente: 'Vente' };

function formaterDate(horodatage) {
  const date = new Date(horodatage);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Le prix de revient n'est pas déplacé par tous les mouvements : une vente partielle le
// laisse intact. Le dire en toutes lettres vaut mieux que d'afficher « +0,00 », que
// l'utilisateur devrait interpréter.
//
// La comparaison passe par le comparateur exact du module de formatage, et non par une
// conversion en nombre. La règle vaut aussi pour un test : « vaut-il zéro » est une
// question posée sur un montant, et y répondre en flottant rouvrirait la porte que
// toute la chaîne s'emploie à tenir fermée.
function estNul(montant) {
  return montant === null || montant === undefined || comparerDecimales(montant, '0') === 0;
}

export default function FriseMouvements({
  mouvements = [],
  classe,
  symbole,
  devise = 'EUR',
  masque = false,
  surSuppression,
}) {
  if (mouvements.length === 0) {
    return (
      <p className="frise-mouvements__vide">
        Aucun mouvement enregistré sur cette position.
      </p>
    );
  }

  // Le serveur rend les mouvements dans l'ordre du calcul, du plus ancien au plus
  // récent. L'affichage les renverse : ce qui vient de se produire est ce qu'on vient
  // consulter. L'inversion se fait sur une copie, la liste reçue n'appartenant pas à
  // ce composant.
  const duPlusRecent = [...mouvements].reverse();

  return (
    <ol className="frise-mouvements">
      {duPlusRecent.map((mouvement) => {
        const date = formaterDate(mouvement.date_transaction);

        return (
          <li key={mouvement.id} className={`frise-mouvements__evenement frise-mouvements__evenement--${mouvement.sens}`}>
            <div className="frise-mouvements__tete">
              <span className={`frise-mouvements__etiquette frise-mouvements__etiquette--${mouvement.sens}`}>
                {LIBELLES_SENS[mouvement.sens] ?? mouvement.sens}
              </span>
              {date && <span className="frise-mouvements__date">{date}</span>}
              <span className="frise-mouvements__quantite">
                {/* Le signe double une information déjà portée par l'étiquette Achat ou
                    Vente : il aide le balayage visuel, il n'a rien à annoncer de plus. */}
                <span aria-hidden="true">{mouvement.sens === 'achat' ? '+' : '−'}</span>
                <Montant
                  valeur={mouvement.quantite}
                  type="quantite"
                  classe={classe}
                  symbole={symbole}
                />
              </span>
            </div>

            <dl className="frise-mouvements__details">
              <div>
                <dt>Prix unitaire</dt>
                <dd>
                  {masque ? '••••' : <Montant valeur={mouvement.prix_unitaire} type="cours" devise={devise} />}
                </dd>
              </div>
              <div>
                <dt>Montant</dt>
                <dd>{masque ? '••••' : <Montant valeur={mouvement.montant} devise={devise} />}</dd>
              </div>
              {!estNul(mouvement.frais) && (
                <div>
                  <dt>Frais</dt>
                  <dd>{masque ? '••••' : <Montant valeur={mouvement.frais} devise={devise} />}</dd>
                </div>
              )}
              {mouvement.plus_value_realisee !== null && (
                <div>
                  <dt>Plus-value réalisée</dt>
                  <dd>
                    {masque ? (
                      '••••'
                    ) : (
                      <Variation valeur={mouvement.plus_value_realisee} mode="absolue" devise={devise} />
                    )}
                  </dd>
                </div>
              )}
              <div className="frise-mouvements__effet">
                <dt>Effet sur le prix de revient</dt>
                <dd>
                  {estNul(mouvement.effet_pru) ? (
                    <span className="frise-mouvements__inchange">inchangé</span>
                  ) : masque ? (
                    '••••'
                  ) : (
                    <Variation valeur={mouvement.effet_pru} mode="absolue" devise={devise} />
                  )}
                </dd>
              </div>
            </dl>

            {surSuppression && (
              <button
                type="button"
                className="frise-mouvements__suppression"
                onClick={() => surSuppression(mouvement)}
              >
                {/* Le libellé nomme le mouvement visé : « Supprimer », lu seul dans une
                    liste de liens, ne dirait pas lequel des quatre serait supprimé. */}
                <span aria-hidden="true">Supprimer</span>
                <span className="lecteur-ecran-seulement">
                  Supprimer {LIBELLES_SENS[mouvement.sens]?.toLowerCase()} du {date}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
