import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';
import Marque from '../composants/Marque';

// Choix d'un nouveau mot de passe à partir d'une clé de réinitialisation.
//
// L'opération ne connecte pas : celui qui vient de poser un mot de passe doit s'en
// servir, ce qui prouve qu'il l'a bien enregistré. Toutes les sessions du compte sont par
// ailleurs closes — on réinitialise précisément quand on ne maîtrise plus l'accès, et
// laisser vivre les sessions existantes viderait l'opération de son sens.

const LONGUEUR_MINIMALE = 10;

export default function Reinitialisation() {
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();

  // La clé peut arriver par l'adresse, depuis l'écran de demande, ou être recopiée à la
  // main. Le champ reste modifiable dans les deux cas.
  const [jeton, setJeton] = useState(() => parametres.get('jeton') ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const tropCourt = motDePasse.length > 0 && motDePasse.length < LONGUEUR_MINIMALE;
  const discordant = confirmation.length > 0 && confirmation !== motDePasse;

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);

    // Les deux contrôles de forme se posent sous leur champ, où l'utilisateur regarde.
    // Le bloc en tête ne sert qu'au cas qu'ils ne couvrent pas — un champ resté vide,
    // sur lequel il n'y a pas encore de saisie à commenter — et à ce que rend le
    // serveur. Sans cette distinction, le même message s'afficherait deux fois.
    if (motDePasse.length < LONGUEUR_MINIMALE) {
      if (!tropCourt) {
        setErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`);
      }
      return;
    }
    if (confirmation !== motDePasse) {
      if (!discordant) {
        setErreur('Les deux saisies ne correspondent pas.');
      }
      return;
    }

    setEnCours(true);

    try {
      await api.reinitialiserMotDePasse({ jeton: jeton.trim(), nouveauMotDePasse: motDePasse });
      naviguer('/connexion', {
        replace: true,
        state: {
          message:
            'Mot de passe enregistré. Connectez-vous avec celui que vous venez de choisir.',
        },
      });
    } catch (echec) {
      // Le serveur rend un refus unique pour les quatre causes possibles — clé inconnue,
      // déjà servie, expirée, compte désactivé. Le reprendre tel quel évite d'apprendre
      // à un tiers laquelle s'applique.
      setErreur(echec.message);
      setEnCours(false);
    }
  }

  return (
    <main className="authentification">
      <div className="authentification__carte">
        <p className="authentification__marque">
          <Marque taille={28} />
          WalletWatch
        </p>
        <h1 className="authentification__titre">Nouveau mot de passe</h1>
        <p className="authentification__intro">
          Saisissez la clé reçue, puis le mot de passe que vous souhaitez utiliser.
        </p>

        {erreur && <Message variante="erreur">{erreur}</Message>}

        <form onSubmit={soumettre} noValidate>
          <Champ
            label="Clé de réinitialisation"
            valeur={jeton}
            onChange={(evenement) => setJeton(evenement.target.value)}
            aide="Elle est valable une heure, et une seule fois."
            autoComplete="off"
            obligatoire
          />

          <Champ
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            valeur={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            erreur={tropCourt ? `Au moins ${LONGUEUR_MINIMALE} caractères.` : undefined}
            aide={`${LONGUEUR_MINIMALE} caractères au minimum.`}
            obligatoire
          />

          <Champ
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            valeur={confirmation}
            onChange={(evenement) => setConfirmation(evenement.target.value)}
            erreur={discordant ? 'Les deux saisies ne correspondent pas.' : undefined}
            obligatoire
          />

          <Bouton type="submit" enCours={enCours} desactive={!jeton.trim()}>
            Enregistrer le mot de passe
          </Bouton>
        </form>

        <p className="authentification__bascule">
          <Link to="/mot-de-passe-oublie">Demander une nouvelle clé</Link>
        </p>
      </div>
    </main>
  );
}
