import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import { CLE_DEVISE, CLE_MASQUAGE, lirePreference, ecrirePreference } from '../utils/preferences';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Carte from '../composants/Carte';
import Message from '../composants/Message';
import MessageErreur from '../composants/MessageErreur';
import Confirmation from '../composants/Confirmation';
import BasculeDevise from '../composants/BasculeDevise';
import MasquageMontants from '../composants/MasquageMontants';
import Squelette from '../composants/Squelette';
import './Compte.css';

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}

// Le serveur renvoie les erreurs de formulaire champ par champ, au format
// [{ champ, message }]. La conversion en objet évite de parcourir le tableau à chaque
// champ affiché.
function erreursParChamp(echec) {
  if (!(echec instanceof ErreurApi) || !echec.champs) {
    return {};
  }
  return Object.fromEntries(echec.champs.map(({ champ, message }) => [champ, message]));
}

function formaterDate(valeur) {
  if (!valeur) {
    return null;
  }
  return new Date(valeur).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const LIBELLES_ROLE = { utilisateur: 'Utilisateur', admin: 'Administrateur' };

export default function Compte() {
  const { jeton, deconnecter } = useAuthentification();
  const naviguer = useNavigate();

  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  // Préférences d'affichage : mêmes clés et mêmes accesseurs que les autres écrans, qui
  // les lisent au montage. Cet écran est celui qui les règle, il n'en détient pas une
  // seconde copie (D83).
  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  const [ancienMotDePasse, setAncienMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('');
  const [erreursMotDePasse, setErreursMotDePasse] = useState({});
  const [motDePasseEnCours, setMotDePasseEnCours] = useState(false);
  const [confirmationChangement, setConfirmationChangement] = useState(null);

  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState(null);

  const [aSupprimer, setASupprimer] = useState(false);
  const [motDePasseSuppression, setMotDePasseSuppression] = useState('');
  const [erreurSuppression, setErreurSuppression] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setProfil(await api.profil(jeton));
    } catch (echec) {
      setErreur(echec);
    } finally {
      setChargement(false);
    }
  }, [jeton]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function soumettreMotDePasse(evenement) {
    evenement.preventDefault();
    setConfirmationChangement(null);

    // La concordance des deux saisies est une vérification de formulaire, pas une règle
    // métier : le serveur n'a pas à connaître le champ de confirmation.
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setErreursMotDePasse({
        confirmationMotDePasse: 'La confirmation ne correspond pas au nouveau mot de passe.',
      });
      return;
    }

    setErreursMotDePasse({});
    setMotDePasseEnCours(true);

    try {
      await api.changerMotDePasse(jeton, { ancienMotDePasse, nouveauMotDePasse });
      setAncienMotDePasse('');
      setNouveauMotDePasse('');
      setConfirmationMotDePasse('');
      // La session reste ouverte : le jeton ne dépend pas du mot de passe. Le dire
      // évite que l'utilisateur s'attende à être déconnecté.
      setConfirmationChangement(
        'Mot de passe modifié. Votre session reste ouverte, le prochain accès demandera le nouveau mot de passe.'
      );
    } catch (echec) {
      const parChamp = erreursParChamp(echec);
      setErreursMotDePasse(
        Object.keys(parChamp).length > 0 ? parChamp : { ancienMotDePasse: echec.message }
      );
    } finally {
      setMotDePasseEnCours(false);
    }
  }

  async function exporter() {
    setErreurExport(null);
    setExportEnCours(true);

    try {
      const { blob, nomFichier } = await api.exporterMouvements(jeton);

      // Le fichier arrive par un appel authentifié : il n'existe que dans la page, et
      // c'est un lien éphémère qui le remet à l'utilisateur. Un lien pointant sur
      // l'adresse de l'API partirait sans jeton, le jeton ne vivant qu'en mémoire (D57).
      const adresse = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(adresse);
    } catch (echec) {
      setErreurExport(echec.message);
    } finally {
      setExportEnCours(false);
    }
  }

  async function supprimerCompte() {
    setErreurSuppression(null);
    setSuppressionEnCours(true);

    try {
      // Le mot de passe part avec la demande : c'est le serveur qui le vérifie, et lui
      // seul qui décide si la suppression a lieu.
      await api.supprimerCompte(jeton, { motDePasse: motDePasseSuppression });
      deconnecter();
      naviguer('/connexion', {
        replace: true,
        state: { message: 'Votre compte et toutes vos données ont été supprimés.' },
      });
    } catch (echec) {
      const parChamp = erreursParChamp(echec);
      setErreurSuppression(parChamp.motDePasse ?? echec.message);
      setSuppressionEnCours(false);
    }
  }

  if (chargement && !profil) {
    return (
      <div className="compte" aria-busy="true">
        <h1 className="compte__titre">Compte</h1>
        <p className="lecteur-ecran-seulement" role="status">
          Chargement des informations du compte
        </p>
        <Squelette forme="bloc" hauteur="8rem" />
        <Squelette forme="bloc" hauteur="12rem" />
      </div>
    );
  }

  if (erreur && !profil) {
    const nature = natureDeLErreur(erreur);
    return (
      <div className="compte">
        <h1 className="compte__titre">Compte</h1>
        <MessageErreur
          nature={nature}
          message={nature === 'api' ? erreur.message : undefined}
          libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
          surAction={nature === 'session' ? () => naviguer('/connexion') : charger}
        />
      </div>
    );
  }

  return (
    <div className="compte">
      <div className="compte__entete">
        <h1 className="compte__titre">Compte</h1>
      </div>

      <Carte titre="Informations" className="compte__carte">
        <dl className="compte__informations">
          <div className="compte__ligne">
            <dt>Adresse électronique</dt>
            <dd>{profil.email}</dd>
          </div>
          <div className="compte__ligne">
            <dt>Pseudonyme</dt>
            <dd>{profil.pseudo}</dd>
          </div>
          <div className="compte__ligne">
            <dt>Inscrit depuis le</dt>
            <dd>{formaterDate(profil.date_inscription) ?? '—'}</dd>
          </div>
          <div className="compte__ligne">
            <dt>Rôle</dt>
            <dd>{LIBELLES_ROLE[profil.role] ?? profil.role}</dd>
          </div>
        </dl>
        <p className="compte__note">Ces informations ne sont pas modifiables.</p>
      </Carte>

      <Carte titre="Sécurité" className="compte__carte">
        {confirmationChangement && <Message variante="information">{confirmationChangement}</Message>}

        <form onSubmit={soumettreMotDePasse} noValidate className="compte__formulaire">
          <Champ
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            valeur={ancienMotDePasse}
            onChange={(e) => setAncienMotDePasse(e.target.value)}
            erreur={erreursMotDePasse.ancienMotDePasse}
            obligatoire
          />
          <Champ
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            valeur={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
            erreur={erreursMotDePasse.nouveauMotDePasse}
            aide="Dix caractères au minimum."
            obligatoire
          />
          <Champ
            label="Confirmer le nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            valeur={confirmationMotDePasse}
            onChange={(e) => setConfirmationMotDePasse(e.target.value)}
            erreur={erreursMotDePasse.confirmationMotDePasse}
            obligatoire
          />
          <Bouton type="submit" enCours={motDePasseEnCours}>
            Changer le mot de passe
          </Bouton>
        </form>

        <div className="compte__actions">
          <Bouton variante="secondaire" onClick={deconnecter}>
            Se déconnecter
          </Bouton>
          <Bouton variante="danger" onClick={() => setASupprimer(true)}>
            Supprimer mon compte
          </Bouton>
        </div>
      </Carte>

      <Carte titre="Affichage" className="compte__carte">
        <div className="compte__reglage">
          <div>
            <p className="compte__reglage-libelle">Devise d&apos;affichage</p>
            <p className="compte__note">
              Les calculs restent en euros ; la bascule ne change que l&apos;affichage.
            </p>
          </div>
          <BasculeDevise
            devise={devise}
            surChangement={(choix) => {
              setDevise(choix);
              ecrirePreference(CLE_DEVISE, choix);
            }}
          />
        </div>

        <div className="compte__reglage">
          <div>
            <p className="compte__reglage-libelle">Masquage des montants</p>
            <p className="compte__note">
              Remplace les montants par des points sur l&apos;ensemble des écrans.
            </p>
          </div>
          <MasquageMontants
            masque={masque}
            surChangement={(valeur) => {
              setMasque(valeur);
              ecrirePreference(CLE_MASQUAGE, valeur ? 'oui' : 'non');
            }}
          />
        </div>
      </Carte>

      <Carte titre="Données" className="compte__carte">
        <p className="compte__note">
          Exporte la totalité de vos mouvements, tous actifs confondus, au format CSV :
          date, sens, actif, classe, quantité, prix unitaire, frais et montant. Les
          montants y sont écrits en euros, sans mise en forme.
        </p>
        {erreurExport && <Message variante="erreur">{erreurExport}</Message>}
        <Bouton variante="secondaire" onClick={exporter} enCours={exportEnCours}>
          Exporter mes mouvements
        </Bouton>
      </Carte>

      <Carte titre="À propos" className="compte__carte">
        <dl className="compte__informations">
          <div className="compte__ligne">
            <dt>Version</dt>
            <dd>0.1.0</dd>
          </div>
          {/* Sources et fréquences réelles : elles reprennent les adaptateurs branchés
              et les durées de vie du cache définies côté serveur (D21). */}
          <div className="compte__ligne">
            <dt>Cryptomonnaies</dt>
            <dd>Coinbase, rafraîchi toutes les 2 minutes</dd>
          </div>
          <div className="compte__ligne">
            <dt>Devises</dt>
            <dd>Frankfurter (BCE), rafraîchi une fois par heure</dd>
          </div>
          <div className="compte__ligne">
            <dt>Métaux précieux</dt>
            <dd>gold-api, rafraîchi toutes les 10 minutes</dd>
          </div>
          <div className="compte__ligne">
            <dt>Actions</dt>
            <dd>Fournisseur non branché : ces positions ne sont pas valorisées</dd>
          </div>
        </dl>
        <p className="compte__note">
          CapitAll est un outil de suivi. Il ne fournit aucun conseil en investissement et
          ne constitue pas une recommandation d&apos;achat ou de vente.
        </p>
      </Carte>

      {/* Le libellé du bouton de confirmation diffère de celui qui ouvre le dialogue :
          deux commandes portant le même nom accessible seraient indistinguables à
          l'oreille, et c'est la destructrice qui prêterait à confusion. */}
      {aSupprimer && (
        <Confirmation
          titre="Supprimer définitivement votre compte ?"
          consequence="Vos positions, vos mouvements, vos seuils et l'historique de votre patrimoine seront supprimés en même temps que votre compte. Cette opération est irréversible."
          libelleConfirmation="Supprimer définitivement"
          enCours={suppressionEnCours}
          surAnnulation={() => {
            setASupprimer(false);
            setMotDePasseSuppression('');
            setErreurSuppression(null);
          }}
          surConfirmation={supprimerCompte}
        >
          <Champ
            label="Saisissez votre mot de passe pour confirmer"
            type="password"
            autoComplete="current-password"
            valeur={motDePasseSuppression}
            onChange={(e) => setMotDePasseSuppression(e.target.value)}
            erreur={erreurSuppression}
            obligatoire
          />
        </Confirmation>
      )}
    </div>
  );
}
