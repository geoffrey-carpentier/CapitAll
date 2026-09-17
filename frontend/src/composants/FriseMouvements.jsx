import './FriseMouvements.css';
import Montant from './Montant';
import Variation from './Variation';
import { comparerDecimales, formaterQuantiteEnNature } from '../utils/formatage';

// Chronologie des mouvements d'une position, en liste ordonnée sémantique.
//
// L'effet de chaque mouvement sur le prix de revient arrive calculé par le serveur, qui
// rejoue l'historique de la position.

// Une sortie non marchande (retrait, transfert) ne doit pas se lire comme une vente.
const LIBELLES_SENS = { achat: 'Achat', vente: 'Vente', sortie_non_marchande: 'Sortie' };

function formaterDate(horodatage) {
  const date = new Date(horodatage);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Test de nullité par le comparateur exact, sans conversion en nombre.
function estNul(montant) {
  return montant === null || montant === undefined || comparerDecimales(montant, '0') === 0;
}

export default function FriseMouvements({
  mouvements = [],
  classe,
  symbole,
  devise = 'EUR',
  masque = false,
  surCorrection,
  surSuppression,
}) {
  if (mouvements.length === 0) {
    return (
      <p className="frise-mouvements__vide">
        Aucun mouvement enregistré sur cette position.
      </p>
    );
  }

  // Le serveur rend l'ordre chronologique ; l'affichage commence par le plus récent,
  // sur une copie pour ne pas modifier la liste reçue.
  const duPlusRecent = [...mouvements].reverse();

  return (
    <ol className="frise-mouvements">
      {duPlusRecent.map((mouvement) => {
        const date = formaterDate(mouvement.date_transaction);
        // Une sortie a prix et montant à zéro en base : ils ne sont pas affichés.
        const marchand = mouvement.sens !== 'sortie_non_marchande';

        return (
          <li key={mouvement.id} className={`frise-mouvements__evenement frise-mouvements__evenement--${mouvement.sens}`}>
            <div className="frise-mouvements__tete">
              <span className={`frise-mouvements__etiquette frise-mouvements__etiquette--${mouvement.sens}`}>
                {LIBELLES_SENS[mouvement.sens] ?? mouvement.sens}
              </span>
              {date && <span className="frise-mouvements__date">{date}</span>}
              <span className="frise-mouvements__quantite">
                {/* Signe visuel seulement : l'étiquette porte déjà le sens. */}
                <span aria-hidden="true">{mouvement.sens === 'achat' ? '+' : '−'}</span>
                {masque ? (
                  <span aria-label="Quantité masquée">•••• {symbole}</span>
                ) : (
                  <Montant
                    valeur={mouvement.quantite}
                    type="quantite"
                    classe={classe}
                    symbole={symbole}
                  />
                )}
              </span>
            </div>

            <dl className="frise-mouvements__details">
              {marchand && (
                <div>
                  <dt>Prix unitaire</dt>
                  <dd>
                    {masque ? '••••' : <Montant valeur={mouvement.prix_unitaire} type="cours" devise={devise} />}
                  </dd>
                </div>
              )}
              {marchand && (
                <div>
                  <dt>Montant</dt>
                  <dd>{masque ? '••••' : <Montant valeur={mouvement.montant} devise={devise} />}</dd>
                </div>
              )}
              {!estNul(mouvement.frais) && (
                <div>
                  <dt>Frais</dt>
                  <dd>
                    {masque ? (
                      '••••'
                    ) : (
                      <>
                        <Montant valeur={mouvement.frais} devise={devise} />
                        {/* Montant réellement prélevé quand les frais ne sont pas en euros. */}
                        {mouvement.frais_unite && mouvement.frais_unite !== 'EUR' && (
                          <span className="frise-mouvements__frais-origine">
                            {' '}
                            ({formaterQuantiteEnNature(mouvement.frais_montant, mouvement.frais_unite)})
                          </span>
                        )}
                      </>
                    )}
                  </dd>
                </div>
              )}
              {/* Valeur emportée par une sortie, au prix de revient : jamais renseignée
                  en même temps qu'une plus-value réalisée. */}
              {mouvement.cout_sortie != null && (
                <div>
                  <dt>Valeur sortie du portefeuille</dt>
                  <dd>{masque ? '••••' : <Montant valeur={mouvement.cout_sortie} devise={devise} />}</dd>
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

            {(surCorrection || surSuppression) && (
              <div className="frise-mouvements__actions">
                {surCorrection && (
                  <button
                    type="button"
                    className="frise-mouvements__correction"
                    onClick={() => surCorrection(mouvement)}
                  >
                    <span aria-hidden="true">Corriger</span>
                    <span className="lecteur-ecran-seulement">
                      Corriger {LIBELLES_SENS[mouvement.sens]?.toLowerCase()} du {date}
                    </span>
                  </button>
                )}
                {surSuppression && (
                  <button
                    type="button"
                    className="frise-mouvements__suppression"
                    onClick={() => surSuppression(mouvement)}
                  >
                    {/* Le nom accessible précise le mouvement visé. */}
                    <span aria-hidden="true">Supprimer</span>
                    <span className="lecteur-ecran-seulement">
                      Supprimer {LIBELLES_SENS[mouvement.sens]?.toLowerCase()} du {date}
                    </span>
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
