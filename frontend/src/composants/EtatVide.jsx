import './EtatVide.css';
import Bouton from './Bouton';

// Absence de contenu à laquelle l'utilisateur peut remédier : portefeuille sans aucune
// position, premier lancement.
//
// À ne pas confondre avec l'absence de résultat après filtrage, qui se traite par un
// simple message dans le contenant : ici, il n'y a rien à voir parce qu'il n'y a rien
// encore, et l'écran doit donc proposer l'action qui crée la première donnée.
//
// L'illustration est décorative et le reste : elle porte aria-hidden, le titre et
// l'explication suffisant à comprendre.
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
