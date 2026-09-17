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
// L'opération ne connecte pas, et le serveur ferme toutes les sessions du compte : on
// réinitialise justement quand on ne maîtrise plus l'accès.

const LONGUEUR_MINIMALE = 10;

export default function Reinitialisation() {
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();

  // Clé reçue par l'adresse ou recopiée à la main ; le champ reste modifiable.
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

    // Les erreurs de forme s'affichent sous leur champ ; le bandeau ne couvre que le
    // champ encore vide et la réponse du serveur, pour ne pas doubler un message.
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
      // Refus unique du serveur (clé inconnue, utilisée, expirée ou compte désactivé),
      // repris tel quel pour ne pas révéler la cause.
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
