// Mise en forme des durées.
//
// Volontairement séparé de utils/formatage.js : celui-ci met en œuvre les six catégories
// de la politique de formatage des nombres, qui portent toutes sur des valeurs
// financières transmises en chaîne. Une ancienneté n'en est pas une, et l'y ajouter
// affaiblirait la règle « toute valeur affichée provient de l'une des six fonctions ».

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

// Date et heure d'un horodatage, en toutes lettres.
//
// Séparé de `formaterAnciennete` : « il y a 3 h » convient à la fraîcheur d'un cours,
// qu'on lit pour savoir s'il est encore bon, mais pas à l'heure d'un relevé historique,
// qu'on lit pour savoir à quel moment de la journée il a été pris.
export function formaterInstant(horodatage) {
  if (!horodatage) {
    return null;
  }

  const instant = new Date(horodatage);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Ancienneté d'un horodatage, en formulation relative.
//
// L'instant courant est un paramètre et non un appel à Date.now() enfoui dans la
// fonction : c'est ce qui rend le résultat testable sans figer l'horloge.
export function formaterAnciennete(horodatage, maintenant = new Date()) {
  if (!horodatage) {
    return null;
  }

  const instant = new Date(horodatage);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const ecart = maintenant.getTime() - instant.getTime();

  // Une horloge client en avance sur le serveur produirait un écart négatif : plutôt
  // qu'une durée absurde, on considère la valeur comme fraîche.
  if (ecart < MINUTE) {
    return "à l'instant";
  }

  if (ecart < HEURE) {
    return `il y a ${Math.floor(ecart / MINUTE)} min`;
  }

  if (ecart < JOUR) {
    return `il y a ${Math.floor(ecart / HEURE)} h`;
  }

  const jours = Math.floor(ecart / JOUR);
  return `il y a ${jours} j`;
}
