import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';

// Contrôles repris de ceux du serveur, qui reste l'autorité : cette validation n'est
// qu'un confort, elle évite un aller-retour réseau pour une erreur évidente.
const LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;

function validerLocalement({ email, motDePasse }) {
  const erreurs = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erreurs.email = "Le format de l'adresse est invalide.";
  }
  if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
    erreurs.motDePasse = `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`;
  }

  return erreurs;
}

export default function Inscription() {
  const { inscrire, estConnecte } = useAuthentification();
  const naviguer = useNavigate();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  if (estConnecte) {
    return <Navigate to="/tableau-de-bord" replace />;
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);

    const erreursLocales = validerLocalement({ email, motDePasse });
    setErreursChamps(erreursLocales);
    if (Object.keys(erreursLocales).length > 0) {
      return;
    }

    setEnCours(true);
    try {
      // L'inscription enchaîne sur la connexion : inutile de ressaisir les mêmes
      // identifiants immédiatement après avoir créé le compte.
      await inscrire({ email, motDePasse, ...(pseudo ? { pseudo } : {}) });
      naviguer('/tableau-de-bord', { replace: true });
    } catch (echec) {
      // Le serveur renvoie une erreur par champ sur une validation, et un message
      // global sur un conflit d'adresse déjà utilisée.
      if (echec.champs) {
        setErreursChamps(
          Object.fromEntries(echec.champs.map((entree) => [entree.champ, entree.message]))
        );
      }
      setErreur(echec.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="authentification">
      <div className="authentification__carte">
        <h1 className="authentification__titre">Créer un compte</h1>
        <p className="authentification__intro">
          Réunissez vos cryptomonnaies, devises, métaux et actions sur un seul tableau de bord.
        </p>

        {erreur && <Message variante="erreur">{erreur}</Message>}

        <form onSubmit={soumettre} noValidate>
          <Champ
            label="Adresse électronique"
            type="email"
            autoComplete="email"
            valeur={email}
            onChange={(e) => setEmail(e.target.value)}
            erreur={erreursChamps.email}
            obligatoire
          />

          <Champ
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            valeur={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            erreur={erreursChamps.motDePasse}
            aide={`${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères minimum.`}
            obligatoire
          />

          <Champ
            label="Pseudonyme"
            valeur={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            erreur={erreursChamps.pseudo}
            aide="Facultatif. À défaut, votre adresse servira de nom d'affichage."
          />

          <Bouton type="submit" enCours={enCours}>
            Créer mon compte
          </Bouton>
        </form>

        <p className="authentification__bascule">
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </p>
      </div>
    </main>
  );
}
