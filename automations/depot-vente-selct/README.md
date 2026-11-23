# SEL-CT Wear — Réponses automatiques aux demandes de dépôt-vente

Gratuit, sans serveur : **Google Sheet + Apps Script + Gmail**.

```
Formulaire envoyé ──► ligne ajoutée dans la feuille « Demandes » (réf. DV-2026-0001)
                     ├─► au déposant : « Votre demande sera traitée dans les 48 heures »  (automatique)
                     └─► à l'équipe : récapitulatif + boutons [✅ Approuver] [✖️ Refuser]
Clic sur « Approuver » ─► page de confirmation (message personnel facultatif)
                     └─► au déposant : procédure de dépôt en 5 étapes, statut « Approuvée — procédure envoyée »
Tous les jours à 9 h ─► rappel à l'équipe pour les demandes sans réponse depuis plus de 24 h
```

Aperçu des e-mails : [`apercu-emails.html`](apercu-emails.html) (données fictives).

## Fichiers

| Fichier | Rôle |
|---|---|
| `Code.gs` | Tout le script, à coller dans Apps Script |
| `appsscript.json` | Manifeste (fuseau Europe/Paris, application web) |
| `outils/simulation.js` | Test local du parcours complet + génération de l'aperçu (`node outils/simulation.js`) |

## Installation (≈ 15 min)

1. **Créer la Google Sheet** « Dépôts-vente SEL-CT Wear » avec le compte Gmail qui doit envoyer les e-mails.
2. **Extensions › Apps Script** → remplacer le contenu de `Code.gs` par celui de ce dossier.
   Paramètres du projet (⚙️) → cocher « Afficher le fichier manifeste appsscript.json » → coller `appsscript.json`.
3. **Compléter en haut de `Code.gs`** :
   - `CONFIG.EMAIL_EQUIPE` : l'adresse qui reçoit les demandes ;
   - `PROCEDURE` : vos vraies conditions (modalités de dépôt, prix, durée, commission, paiement, invendus).
     Tant qu'un champ contient `[À COMPLÉTER`, **l'approbation est bloquée** : aucun e-mail incomplet ne peut partir.
   - facultatif : `LOGO_URL` (URL du logo officiel, ex. celui du CDN Shopify), `EMAIL_REPONSE`, `LIEN_CONTRAT`.
4. **Exécuter `installer`** (menu déroulant des fonctions → ▶ Exécuter) et accepter les autorisations Google.
   Cela crée l'onglet « Demandes », le déclencheur du formulaire et le rappel quotidien.
5. **Déployer › Nouveau déploiement › Application web** — Exécuter en tant que : *Moi* ; Accès : *Tout le monde*.
   Copier l'URL qui finit par `/exec` dans `CONFIG.URL_WEBAPP`, enregistrer.
   (Après toute modification du code : *Gérer les déploiements › ✏️ › Nouvelle version*, l'URL reste la même.)
6. Recharger la feuille : un menu **« Dépôt-vente SEL-CT »** apparaît → *Tester avec une fausse demande*.
   Vous recevez l'accusé et la notification sur `EMAIL_EQUIPE` ; cliquez « Approuver » pour voir la procédure.

## Brancher le formulaire

**Option A — Google Form (recommandée, rien d'autre à configurer)**
Dans le Form : *Réponses › Associer à Sheets › Sélectionner une feuille existante* → cette feuille.
Questions conseillées : Prénom, Nom, Adresse e-mail (ou « Collecter les adresses e-mail »), Téléphone, Marques et articles proposés, Nombre de pièces, État, Photos (import de fichiers).
Les intitulés sont reconnus automatiquement (prénom, nom, e-mail, téléphone, photos) ; toutes les autres questions vont dans « Détails ».
Sur sel-ctwear.com : créer une page Shopify « Dépôt-vente » et y intégrer le Form (*Envoyer › < >* → coller l'iframe dans l'éditeur HTML de la page).

**Option B — Tally, Typeform, Jotform, Zapier/Make…**
1. Mettre dans `CONFIG.CLE_WEBHOOK` une chaîne aléatoire d'au moins 16 caractères.
2. Configurer le webhook du formulaire vers : `<URL_WEBAPP>?cle=<CLE_WEBHOOK>` (méthode POST, JSON).
   Le format Tally est reconnu nativement ; sinon envoyer un JSON plat `{"Prénom": "...", "Email": "...", ...}`.

Le formulaire de contact natif de Shopify ne peut pas déclencher de webhook : utilisez A ou B.

## Approuver une demande

- **Depuis l'e-mail** : bouton *✅ Approuver et envoyer la procédure* → page de confirmation → *Confirmer*.
  L'ouverture du lien seule n'envoie rien (les antivirus de messagerie ouvrent parfois les liens).
- **Depuis la feuille** : sélectionner la ligne → menu *Dépôt-vente SEL-CT › Approuver la demande sélectionnée*.
- Refuser fonctionne pareil et envoie un refus courtois (avec un motif facultatif).
- Une demande déjà approuvée ou refusée ne renvoie jamais d'e-mail une seconde fois.

## Sécurité et limites

- Chaque demande a un jeton secret (colonne masquée) : sans lui, les liens Approuver/Refuser ne fonctionnent pas. Ne transférez pas l'e-mail de notification à l'extérieur.
- Les réponses du formulaire sont échappées dans les e-mails et neutralisées dans la feuille (pas de formule injectée).
- Quota Gmail : ~100 destinataires/jour avec un compte gratuit, 1 500 avec Google Workspace.
- La promesse « 48 heures » est réglable dans `CONFIG.DELAI_REPONSE` ; le rappel quotidien signale les demandes qui la dépassent.
- Les textes par défaut de la préparation des articles sont des suggestions : relisez-les avant la mise en service.
