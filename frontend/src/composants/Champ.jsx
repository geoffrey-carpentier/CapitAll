import { useId } from 'react';
import './Champ.css';

// Champ de formulaire accessible.
//
// Trois liens sont établis explicitement, sans quoi un lecteur d'écran n'annoncerait
// ni le libellé, ni l'erreur, ni le caractère obligatoire :
//   - le label pointe sur le champ par son identifiant ;
//   - le message d'erreur est rattaché au champ par aria-describedby ;
//   - aria-invalid signale l'erreur, en plus de la bordure rouge, la couleur ne
//     devant jamais porter seule une information.
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

      <input
        id={identifiant}
        type={type}
        className={`champ__saisie${erreur ? ' champ__saisie--erreur' : ''}`}
        value={valeur}
        onChange={onChange}
        required={obligatoire}
        aria-invalid={erreur ? 'true' : undefined}
        aria-describedby={decritPar || undefined}
        {...proprietes}
      />

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
