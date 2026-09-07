import { useId, useState } from 'react';
import './Champ.css';

// Champ de formulaire accessible.
//
// Trois liens sont établis explicitement, sans quoi un lecteur d'écran n'annoncerait
// ni le libellé, ni l'erreur, ni le caractère obligatoire :
//   - le label pointe sur le champ par son identifiant ;
//   - le message d'erreur est rattaché au champ par aria-describedby ;
//   - aria-invalid signale l'erreur, en plus de la bordure rouge, la couleur ne
//     devant jamais porter seule une information.
//
// Un champ de mot de passe reçoit en plus une commande de révélation. Elle sert le cas le
// plus banal de l'écran de connexion : une saisie refusée sans qu'on sache si le mot de
// passe est faux ou mal tapé. Le champ bascule entre `password` et `text` ; rien n'est
// transmis ni conservé différemment, seul l'affichage change. L'état est porté par
// `aria-pressed` plutôt que par le seul dessin de l'icône, et le champ reste désigné par
// le même label, donc annoncé de la même façon.
export default function Champ({
  label,
  type = 'text',
  valeur,
  onChange,
  erreur,
  obligatoire = false,
  aide,
  ...proprietes
}) {
  const identifiant = useId();
  const idErreur = `${identifiant}-erreur`;
  const idAide = `${identifiant}-aide`;

  const [revele, setRevele] = useState(false);
  const estMotDePasse = type === 'password';
  const typeEffectif = estMotDePasse && revele ? 'text' : type;

  const decritPar = [erreur ? idErreur : null, aide ? idAide : null].filter(Boolean).join(' ');

  return (
    <div className="champ">
      <label className="champ__label" htmlFor={identifiant}>
        {label}
        {obligatoire && (
          <span className="champ__obligatoire" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {obligatoire && <span className="lecteur-ecran-seulement"> (obligatoire)</span>}
      </label>

      <div className={`champ__zone${estMotDePasse ? ' champ__zone--revelable' : ''}`}>
        <input
          id={identifiant}
          type={typeEffectif}
          className={`champ__saisie${erreur ? ' champ__saisie--erreur' : ''}`}
          value={valeur}
          onChange={onChange}
          required={obligatoire}
          aria-invalid={erreur ? 'true' : undefined}
          aria-describedby={decritPar || undefined}
          {...proprietes}
        />

        {estMotDePasse && (
          <button
            type="button"
            className="champ__revelation"
            onClick={() => setRevele((etat) => !etat)}
            aria-pressed={revele}
            aria-label={revele ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
              <circle cx="12" cy="12" r="3" />
              {revele && <path d="M4 4l16 16" />}
            </svg>
          </button>
        )}
      </div>

      {aide && (
        <p className="champ__aide" id={idAide}>
          {aide}
        </p>
      )}

      {erreur && (
        // role="alert" fait annoncer le message dès son apparition, sans attendre que
        // l'utilisateur atteigne le champ.
        <p className="champ__erreur" id={idErreur} role="alert">
          <span aria-hidden="true">⚠ </span>
          {erreur}
        </p>
      )}
    </div>
  );
}
