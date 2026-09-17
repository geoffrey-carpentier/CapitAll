import './EtatVide.css';
import Bouton from './Bouton';

// Écran vide auquel l'utilisateur peut remédier (aucune position, premier lancement),
// avec l'action qui crée la première donnée. Un filtre sans résultat ne l'utilise pas.
// L'illustration est décorative.
export default function EtatVide({ titre, explication, libelleAction, surAction }) {
  return (
    <div className="etat-vide">
      <span className="etat-vide__illustration" aria-hidden="true" />
      <h2 className="etat-vide__titre">{titre}</h2>
      {explication && <p className="etat-vide__explication">{explication}</p>}
      {libelleAction && surAction && (
        <Bouton type="button" onClick={surAction}>
          {libelleAction}
        </Bouton>
      )}
    </div>
  );
}
