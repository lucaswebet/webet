/**
 * SEL-CT Wear — Automatisation des demandes de dépôt-vente
 * --------------------------------------------------------
 * 1. Une demande arrive (Google Form lié à la feuille, ou webhook Tally / Typeform / Jotform…)
 *    → elle est enregistrée dans l'onglet « Demandes » avec une référence (DV-2026-0001)
 *    → le déposant reçoit automatiquement un accusé : « votre demande sera traitée dans les 48 heures »
 *    → l'équipe reçoit un e-mail avec deux boutons : APPROUVER / REFUSER
 * 2. Un clic sur APPROUVER (dans l'e-mail ou via le menu de la feuille)
 *    → le déposant reçoit la procédure de dépôt
 *    → le statut passe à « Approuvée — procédure envoyée » (jamais d'envoi en double)
 * 3. Chaque matin, un rappel liste à l'équipe les demandes en attente depuis plus de 24 h.
 *
 * Installation pas à pas : voir README.md
 */

// =====================================================================
// 1. CONFIGURATION — à compléter avant la mise en service
// =====================================================================
const CONFIG = {
  NOM_BOUTIQUE: 'SEL-CT Wear',
  SITE: 'https://sel-ctwear.com',
  EMAIL_EQUIPE: '[À COMPLÉTER]',       // adresse qui reçoit les nouvelles demandes et les boutons
  EMAIL_REPONSE: '',                   // adresse de réponse pour les déposants (vide = ce compte Google)
  LOGO_URL: '',                        // URL publique du logo OFFICIEL (ex. fichier du CDN Shopify) ; vide = nom en texte
  DELAI_REPONSE: '48 heures',
  SIGNATURE: "L'équipe SEL-CT Wear",
  CLE_WEBHOOK: '[À COMPLÉTER]',        // mot de passe long et aléatoire, uniquement si un formulaire externe envoie un webhook
  URL_WEBAPP: '',                      // URL /exec de l'application web (Déployer › Gérer les déploiements)
  RAPPEL_APRES_HEURES: 24,             // rappel à l'équipe pour les demandes plus anciennes que ce délai
};

// Contenu de la procédure envoyée après approbation.
// Tant qu'un champ contient « [À COMPLÉTER », l'approbation est bloquée (aucun e-mail incomplet ne part).
const PROCEDURE = {
  MODALITES_DEPOT: '[À COMPLÉTER — adresse et horaires de dépôt en boutique, et/ou adresse d’envoi par colis]',
  PRIX: '[À COMPLÉTER — comment le prix de vente est fixé (par SEL-CT Wear, en accord avec vous…)]',
  DUREE_DEPOT: '[À COMPLÉTER — ex. « 3 mois »]',
  COMMISSION: '[À COMPLÉTER — ex. « vous percevez X % du prix de vente »]',
  PAIEMENT: '[À COMPLÉTER — délai et moyen de reversement (virement…)]',
  INVENDUS: '[À COMPLÉTER — ce qu’il advient des articles non vendus à la fin du dépôt]',
  PREPARATION: [                       // liste modifiable
    'Articles propres, lavés et défroissés.',
    'Étiquettes de marque, de taille et de composition conservées autant que possible.',
    'Défauts éventuels (tache, accroc, bouloche…) signalés à l’avance.',
    'Indiquez votre référence de demande avec vos articles (papier dans le colis ou à l’accueil).',
  ],
  LIEN_CONTRAT: '',                    // facultatif : lien vers le contrat / les conditions de dépôt-vente
};

// =====================================================================
// 2. STRUCTURE DE LA FEUILLE
// =====================================================================
const NOM_FEUILLE = 'Demandes';
const ENTETES = ['Référence', 'Reçue le', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Détails de la demande',
  'Photos', 'Source', 'Statut', 'Accusé envoyé le', 'Décision le', 'Note interne', 'Jeton (ne pas modifier)'];
const COL = { REF: 1, RECUE: 2, PRENOM: 3, NOM: 4, EMAIL: 5, TEL: 6, DETAILS: 7, PHOTOS: 8, SOURCE: 9,
  STATUT: 10, ACCUSE: 11, DECISION: 12, NOTE: 13, JETON: 14 };
const STATUT = {
  NOUVELLE: 'Nouvelle',
  EN_ETUDE: 'En cours d’étude',
  APPROUVEE: 'Approuvée — procédure envoyée',
  REFUSEE: 'Refusée',
  ERREUR: 'Erreur d’envoi',
};

// =====================================================================
// 3. INSTALLATION ET MENU
// =====================================================================
/** À exécuter une fois depuis l'éditeur (bouton ▶ Exécuter). */
function installer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Ouvrez ce script depuis la Google Sheet (Extensions › Apps Script).');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  feuille_();

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['surSoumissionFormulaire', 'rappelDemandesEnAttente'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('surSoumissionFormulaire').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('rappelDemandesEnAttente').timeBased().everyDays(1).atHour(9).create();

  const manquants = champsIncomplets_();
  alerte_('Installation terminée ✅\n\n' +
    '• Onglet « ' + NOM_FEUILLE + ' » prêt\n' +
    '• Déclencheur « envoi du formulaire » activé\n' +
    '• Rappel quotidien à 9 h activé\n\n' +
    (manquants.length ? 'Encore à compléter dans CONFIG / PROCEDURE :\n- ' + manquants.join('\n- ')
      : 'Configuration complète.'));
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dépôt-vente SEL-CT')
    .addItem('✅ Approuver la demande sélectionnée', 'approuverSelection')
    .addItem('✖️ Refuser la demande sélectionnée', 'refuserSelection')
    .addItem('↻ Renvoyer l’accusé de réception', 'renvoyerAccuseSelection')
    .addSeparator()
    .addItem('Tester avec une fausse demande', 'testerAvecFausseDemande')
    .addItem('Vérifier la configuration', 'verifierConfiguration')
    .addItem('Installer / réinstaller', 'installer')
    .addToUi();
}

function verifierConfiguration() {
  const manquants = champsIncomplets_();
  alerte_(manquants.length ? 'À compléter :\n- ' + manquants.join('\n- ')
    : 'Configuration complète ✅\nURL des boutons : ' + (urlWebApp_() || 'NON DÉFINIE (déployez l’application web)'));
}

// =====================================================================
// 4. RÉCEPTION DES DEMANDES
// =====================================================================
/** Déclencheur : envoi d'un Google Form lié à cette feuille. */
function surSoumissionFormulaire(e) {
  // Un vrai déclencheur fournit un objet Range ; un appel forgé depuis l'extérieur ne peut pas le faire.
  if (!e || !e.range || typeof e.range.getRow !== 'function') throw new Error('Appel non autorisé.');
  const champs = {};
  Object.keys(e.namedValues || {}).forEach(function (question) {
    const v = [].concat(e.namedValues[question]).filter(String).join(', ').trim();
    if (v && !/^(horodateur|timestamp|horodatage)$/i.test(question)) champs[question] = v;
  });
  enregistrerDemande_(champs, 'Formulaire Google');
}

/** Webhook : formulaires externes (Tally, Typeform via Zapier/Make, Jotform…). URL : <URL_WEBAPP>?cle=<CLE_WEBHOOK> */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!cleWebhookValide_(p.cle)) return json_({ ok: false, erreur: 'clé invalide' });
    let corps = p;
    if (e.postData && e.postData.contents) {
      try { corps = JSON.parse(e.postData.contents); } catch (err) { corps = p; }
    }
    const ref = enregistrerDemande_(aplatirWebhook_(corps), 'Webhook');
    return json_({ ok: true, reference: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erreur: String(err && err.message || err) });
  }
}

function enregistrerDemande_(champs, source) {
  const d = classerChamps_(champs);
  if (!d.email) throw new Error('Aucune adresse e-mail valide dans la demande : ' + JSON.stringify(champs));

  let ligne;
  const verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    const sh = feuille_();
    sh.appendRow([nouvelleReference_(), new Date(), d.prenom, d.nom, d.email, d.tel, d.details.join('\n'),
      d.photos.join('\n'), source, STATUT.NOUVELLE, '', '', '', Utilities.getUuid().replace(/-/g, '')].map(cellule_));
    ligne = sh.getLastRow();
  } finally {
    verrou.releaseLock();
  }

  try {
    envoyerAccuse_(lireDemande_(ligne));
    majLigne_(ligne, { STATUT: STATUT.EN_ETUDE, ACCUSE: new Date() });
  } catch (err) {
    majLigne_(ligne, { STATUT: STATUT.ERREUR, NOTE: 'Accusé non envoyé : ' + (err.message || err) });
  }
  try {
    envoyerNotificationEquipe_(lireDemande_(ligne));
  } catch (err) {
    console.error('Notification équipe non envoyée : ' + err);
  }
  return lireDemande_(ligne).ref;
}

// =====================================================================
// 5. DÉCISION (APPROUVER / REFUSER)
// =====================================================================
/**
 * @param {string} ref       référence DV-…
 * @param {string} action    'approuver' | 'refuser'
 * @param {string} message   message personnel facultatif ajouté à l'e-mail
 * @param {string=} jeton    obligatoire depuis un lien e-mail ; absent depuis le menu de la feuille
 */
function deciderDemande_(ref, action, message, jeton) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(30000);
  try {
    const ligne = trouverLigne_(ref);
    if (!ligne) throw new Error('Demande introuvable : ' + ref);
    const d = lireDemande_(ligne);
    if (jeton !== undefined && (!d.jeton || jeton !== d.jeton)) throw new Error('Lien invalide ou expiré.');
    if (d.statut === STATUT.APPROUVEE || d.statut === STATUT.REFUSEE) {
      return 'La demande ' + ref + ' est déjà « ' + d.statut + ' » (' + date_(d.decision) + '). Aucun e-mail renvoyé.';
    }
    message = String(message || '').trim();
    const note = message ? (d.note ? d.note + '\n' : '') + 'Message envoyé : ' + message : d.note;

    if (action === 'approuver') {
      const manquants = procedureIncomplete_();
      if (manquants.length) {
        throw new Error('Procédure incomplète, rien n’a été envoyé. Complétez dans PROCEDURE : ' + manquants.join(', '));
      }
      envoyerProcedure_(d, message);
      majLigne_(ligne, { STATUT: STATUT.APPROUVEE, DECISION: new Date(), NOTE: note });
      return '✅ Demande ' + ref + ' approuvée : la procédure a été envoyée à ' + d.email + '.';
    }
    if (action === 'refuser') {
      envoyerRefus_(d, message);
      majLigne_(ligne, { STATUT: STATUT.REFUSEE, DECISION: new Date(), NOTE: note });
      return 'Demande ' + ref + ' refusée : la réponse a été envoyée à ' + d.email + '.';
    }
    throw new Error('Action inconnue : ' + action);
  } finally {
    verrou.releaseLock();
  }
}

// --- Depuis la feuille (menu) ---
function approuverSelection() { deciderDepuisFeuille_('approuver'); }
function refuserSelection() { deciderDepuisFeuille_('refuser'); }

function deciderDepuisFeuille_(action) {
  const ui = SpreadsheetApp.getUi();
  const d = demandeSelectionnee_();
  if (!d) return;
  const libelle = action === 'approuver' ? 'APPROUVER' : 'REFUSER';
  const rep = ui.prompt(libelle + ' la demande ' + d.ref + ' (' + d.prenom + ' ' + d.nom + ', ' + d.email + ') ?',
    'Message personnel facultatif à ajouter à l’e-mail (laisser vide sinon) :', ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  try {
    ui.alert(deciderDemande_(d.ref, action, rep.getResponseText()));
  } catch (err) {
    ui.alert('⚠️ ' + (err.message || err));
  }
}

function renvoyerAccuseSelection() {
  const d = demandeSelectionnee_();
  if (!d) return;
  envoyerAccuse_(d);
  majLigne_(d.ligne, { ACCUSE: new Date(), STATUT: d.statut === STATUT.ERREUR || d.statut === STATUT.NOUVELLE ? STATUT.EN_ETUDE : d.statut });
  alerte_('Accusé renvoyé à ' + d.email);
}

function demandeSelectionnee_() {
  const sh = SpreadsheetApp.getActiveSheet();
  const ligne = sh.getActiveRange() && sh.getActiveRange().getRow();
  if (sh.getName() !== NOM_FEUILLE || !ligne || ligne < 2) {
    alerte_('Sélectionnez une ligne de demande dans l’onglet « ' + NOM_FEUILLE + ' ».');
    return null;
  }
  return lireDemande_(ligne);
}

// --- Depuis l'e-mail (application web) ---
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (['approuver', 'refuser'].indexOf(p.action) === -1 || !p.ref || !p.t) {
    return page_('Lien incomplet', '<p>Ce lien n’est pas valide.</p>');
  }
  const ligne = trouverLigne_(p.ref);
  const d = ligne && lireDemande_(ligne);
  if (!d || !d.jeton || d.jeton !== p.t) return page_('Lien invalide', '<p>Ce lien est invalide ou a expiré.</p>');
  if (d.statut === STATUT.APPROUVEE || d.statut === STATUT.REFUSEE) {
    return page_('Déjà traitée', '<p>La demande <b>' + esc_(d.ref) + '</b> est déjà « ' + esc_(d.statut) +
      ' » (' + esc_(date_(d.decision)) + '). Aucun e-mail renvoyé.</p>');
  }
  // Page de confirmation : l'action n'est jamais déclenchée par la simple ouverture du lien
  // (les antivirus de messagerie ouvrent parfois les liens automatiquement).
  const approuver = p.action === 'approuver';
  const contenu =
    '<p>' + (approuver ? 'Approuver' : 'Refuser') + ' la demande <b>' + esc_(d.ref) + '</b> de <b>' +
    esc_(d.prenom + ' ' + d.nom) + '</b> (' + esc_(d.email) + ') ?</p>' +
    '<div class="recap">' + nl2br_(esc_(d.details || '—')) + '</div>' +
    '<p>' + (approuver ? 'La procédure de dépôt sera envoyée au déposant.' : 'Un e-mail de refus courtois sera envoyé au déposant.') + '</p>' +
    '<label>Message personnel facultatif ajouté à l’e-mail :</label>' +
    '<textarea id="msg" rows="4" placeholder="' + (approuver ? 'Ex. : Nous sommes ravis d’accueillir vos pièces…' : 'Ex. : Nous ne prenons pas les articles de cette catégorie pour le moment.') + '"></textarea>' +
    '<button id="go" class="' + (approuver ? 'ok' : 'ko') + '">' + (approuver ? '✅ Confirmer et envoyer la procédure' : '✖️ Confirmer le refus') + '</button>' +
    '<p id="res"></p>' +
    '<script>' +
    'document.getElementById("go").onclick=function(){var b=this;b.disabled=true;b.textContent="Envoi…";' +
    'google.script.run.withSuccessHandler(function(m){document.getElementById("res").textContent=m;b.style.display="none";})' +
    '.withFailureHandler(function(err){document.getElementById("res").textContent="⚠️ "+err.message;b.disabled=false;b.textContent="Réessayer";})' +
    '.executerDecisionWeb(' + JSON.stringify(d.ref) + ',' + JSON.stringify(p.action) + ',' + JSON.stringify(p.t) + ',document.getElementById("msg").value);};' +
    '</script>';
  return page_(approuver ? 'Approuver le dépôt' : 'Refuser le dépôt', contenu);
}

/** Appelée par la page de confirmation (google.script.run). Le jeton secret est obligatoire. */
function executerDecisionWeb(ref, action, jeton, message) {
  if (!jeton) throw new Error('Lien invalide.');
  return deciderDemande_(String(ref), String(action), String(message || ''), String(jeton));
}

// =====================================================================
// 6. RAPPEL ET TEST
// =====================================================================
/** Déclencheur quotidien : liste les demandes sans réponse depuis plus de RAPPEL_APRES_HEURES. */
function rappelDemandesEnAttente() {
  const sh = feuille_();
  const n = sh.getLastRow();
  if (n < 2) return;
  const limite = Date.now() - CONFIG.RAPPEL_APRES_HEURES * 3600 * 1000;
  const enAttente = [];
  for (let ligne = 2; ligne <= n; ligne++) {
    const d = lireDemande_(ligne);
    const ouverte = [STATUT.NOUVELLE, STATUT.EN_ETUDE, STATUT.ERREUR].indexOf(d.statut) !== -1;
    if (ouverte && d.recue instanceof Date && d.recue.getTime() < limite) enAttente.push(d);
  }
  if (!enAttente.length || !emailValide_(CONFIG.EMAIL_EQUIPE)) return;

  const lignes = enAttente.map(function (d) {
    const heures = Math.floor((Date.now() - d.recue.getTime()) / 3600000);
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #E6DED1"><b>' + esc_(d.ref) + '</b> — ' +
      esc_(d.prenom + ' ' + d.nom) + '<br><span style="color:#6B645A;font-size:13px">Reçue il y a ' + heures +
      ' h' + (heures >= 48 ? ' · <b style="color:#A3341F">délai de 48 h dépassé</b>' : '') + '</span><br>' +
      boutonsDecision_(d, true) + '</td></tr>';
  }).join('');
  envoyer_(CONFIG.EMAIL_EQUIPE,
    '⏰ ' + enAttente.length + ' demande(s) de dépôt-vente en attente de réponse',
    gabarit_('Demandes en attente', '<p>Ces demandes attendent une réponse (promesse : ' + esc_(CONFIG.DELAI_REPONSE) + ').</p>' +
      '<table width="100%" cellpadding="0" cellspacing="0">' + lignes + '</table>' + lienFeuille_()));
}

/** Crée une demande fictive : l'accusé ET la notification arrivent sur EMAIL_EQUIPE. */
function testerAvecFausseDemande() {
  if (!emailValide_(CONFIG.EMAIL_EQUIPE)) return alerte_('Renseignez d’abord CONFIG.EMAIL_EQUIPE.');
  const ref = enregistrerDemande_({
    'Prénom': 'Camille', 'Nom': 'Test', 'Adresse e-mail': CONFIG.EMAIL_EQUIPE, 'Téléphone': '06 00 00 00 00',
    'Articles proposés': 'Pull Lacoste col V bleu marine, taille M\nChemise Ralph Lauren blanche, taille L',
    'Nombre de pièces': '2', 'État': 'Très bon état, porté quelques fois',
  }, 'Test');
  alerte_('Demande de test ' + ref + ' créée. Vérifiez la boîte ' + CONFIG.EMAIL_EQUIPE + '.');
}

// =====================================================================
// 7. E-MAILS
// =====================================================================
function envoyerAccuse_(d) {
  const contenu =
    '<p>Bonjour ' + esc_(d.prenom || '') + ',</p>' +
    '<p>Merci pour votre demande de dépôt-vente auprès de ' + esc_(CONFIG.NOM_BOUTIQUE) + '. Nous l’avons bien reçue.</p>' +
    '<p style="font-size:17px"><b>Votre demande sera traitée dans les ' + esc_(CONFIG.DELAI_REPONSE) + '.</b></p>' +
    '<p>Vous recevrez alors notre réponse et, si votre demande est acceptée, la procédure détaillée pour nous confier vos pièces.</p>' +
    '<p>Merci de ne pas nous envoyer ni déposer d’articles avant d’avoir reçu cette réponse.</p>' +
    encadre_('Votre demande — réf. ' + d.ref, nl2br_(esc_(d.details || '—'))) +
    '<p>Une question en attendant ? Il suffit de répondre à cet e-mail en rappelant votre référence.</p>' +
    signature_();
  envoyer_(d.email, 'Nous avons bien reçu votre demande de dépôt-vente (réf. ' + d.ref + ')',
    gabarit_('Demande bien reçue', contenu));
}

function envoyerNotificationEquipe_(d) {
  if (!emailValide_(CONFIG.EMAIL_EQUIPE)) throw new Error('CONFIG.EMAIL_EQUIPE non renseigné.');
  const photos = d.photos ? d.photos.split(/\n|,\s*/).filter(String).map(function (u, i) {
    return /^https?:\/\//.test(u) ? '<a href="' + esc_(u) + '">Photo ' + (i + 1) + '</a>' : esc_(u);
  }).join(' · ') : '—';
  const accuse = d.statut === STATUT.ERREUR
    ? '<p style="color:#A3341F"><b>⚠️ L’accusé de réception n’a pas pu être envoyé :</b> ' + esc_(d.note) + '</p>'
    : '<p style="color:#3D6B3D">✓ Accusé de réception envoyé au déposant (réponse promise sous ' + esc_(CONFIG.DELAI_REPONSE) + ').</p>';
  const contenu =
    '<p>Nouvelle demande de dépôt-vente reçue le ' + esc_(date_(d.recue)) + ' (' + esc_(d.source) + ').</p>' + accuse +
    '<table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">' +
    ligneTableau_('Référence', esc_(d.ref)) +
    ligneTableau_('Déposant', esc_(d.prenom + ' ' + d.nom)) +
    ligneTableau_('E-mail', '<a href="mailto:' + esc_(d.email) + '">' + esc_(d.email) + '</a>') +
    ligneTableau_('Téléphone', esc_(d.tel || '—')) +
    ligneTableau_('Détails', nl2br_(esc_(d.details || '—'))) +
    ligneTableau_('Photos', photos) +
    '</table>' +
    '<div style="margin:24px 0 8px">' + boutonsDecision_(d, false) + '</div>' +
    lienFeuille_();
  envoyer_(CONFIG.EMAIL_EQUIPE, 'Nouvelle demande de dépôt-vente ' + d.ref + ' — ' + (d.prenom + ' ' + d.nom).trim(),
    gabarit_('Nouvelle demande', contenu), d.email);
}

function envoyerProcedure_(d, message) {
  const P = PROCEDURE;
  const etape = function (n, titre, html) {
    return '<tr><td valign="top" style="padding:0 14px 18px 0;width:34px"><div style="width:30px;height:30px;line-height:30px;' +
      'border-radius:15px;background:#1A1A1A;color:#fff;text-align:center;font-weight:bold">' + n + '</div></td>' +
      '<td valign="top" style="padding:0 0 18px"><b>' + titre + '</b><br>' + html + '</td></tr>';
  };
  const contenu =
    '<p>Bonjour ' + esc_(d.prenom || '') + ',</p>' +
    '<p>Bonne nouvelle : après étude, <b>nous acceptons votre demande de dépôt-vente</b> (réf. ' + esc_(d.ref) + '). Merci de votre confiance !</p>' +
    (message ? encadre_('Un mot de notre équipe', nl2br_(esc_(message))) : '') +
    '<p>Voici la marche à suivre :</p>' +
    '<table cellpadding="0" cellspacing="0" width="100%">' +
    etape(1, 'Préparez vos articles', '<ul style="margin:6px 0 0;padding-left:18px">' +
      P.PREPARATION.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>') +
    etape(2, 'Déposez ou envoyez-les', nl2br_(esc_(P.MODALITES_DEPOT)) +
      '<br>Indiquez votre référence <b>' + esc_(d.ref) + '</b>.') +
    etape(3, 'Mise en vente', nl2br_(esc_(P.PRIX)) + '<br>Durée du dépôt : ' + esc_(P.DUREE_DEPOT) + '.') +
    etape(4, 'Votre rémunération', nl2br_(esc_(P.COMMISSION)) + '<br>' + nl2br_(esc_(P.PAIEMENT))) +
    etape(5, 'Articles non vendus', nl2br_(esc_(P.INVENDUS))) +
    '</table>' +
    (P.LIEN_CONTRAT ? '<p>' + bouton_(P.LIEN_CONTRAT, 'Lire les conditions du dépôt-vente', '#1A1A1A') + '</p>' : '') +
    '<p>Une question ? Répondez simplement à cet e-mail.</p>' + signature_();
  envoyer_(d.email, 'Votre dépôt-vente est accepté — procédure à suivre (réf. ' + d.ref + ')',
    gabarit_('Dépôt accepté', contenu));
}

function envoyerRefus_(d, message) {
  const contenu =
    '<p>Bonjour ' + esc_(d.prenom || '') + ',</p>' +
    '<p>Merci d’avoir pensé à ' + esc_(CONFIG.NOM_BOUTIQUE) + ' pour votre dépôt-vente (réf. ' + esc_(d.ref) + ').</p>' +
    '<p>Après étude, nous ne pouvons malheureusement pas donner suite à votre demande cette fois-ci.</p>' +
    (message ? encadre_('Précision de notre équipe', nl2br_(esc_(message))) : '') +
    '<p>N’hésitez pas à nous proposer d’autres pièces à l’avenir.</p>' + signature_();
  envoyer_(d.email, 'Votre demande de dépôt-vente (réf. ' + d.ref + ')', gabarit_('Réponse à votre demande', contenu));
}

function envoyer_(a, sujet, html, repondreA) {
  const options = { htmlBody: html, name: CONFIG.NOM_BOUTIQUE };
  if (repondreA) options.replyTo = repondreA;
  else if (CONFIG.EMAIL_REPONSE) options.replyTo = CONFIG.EMAIL_REPONSE;
  GmailApp.sendEmail(a, sujet, texteBrut_(html), options);
}

// --- Gabarit HTML (styles en ligne pour la compatibilité des messageries) ---
function gabarit_(titre, contenu) {
  const entete = CONFIG.LOGO_URL
    ? '<img src="' + esc_(CONFIG.LOGO_URL) + '" alt="' + esc_(CONFIG.NOM_BOUTIQUE) + '" style="max-height:56px">'
    : '<span style="font-size:20px;font-weight:bold;letter-spacing:.5px">' + esc_(CONFIG.NOM_BOUTIQUE) + '</span>';
  return '<!doctype html><html><body style="margin:0;background:#F4EFE6">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6"><tr><td align="center" style="padding:28px 12px">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:6px;' +
    'font-family:Helvetica,Arial,sans-serif;color:#1A1A1A;font-size:15px;line-height:1.55">' +
    '<tr><td align="center" style="padding:28px 32px 18px;border-bottom:1px solid #E6DED1">' + entete + '</td></tr>' +
    '<tr><td style="padding:26px 32px 30px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8A8276;margin-bottom:14px">' +
    esc_(titre) + '</div>' + contenu + '</td></tr>' +
    '<tr><td align="center" style="padding:16px 32px;background:#FAF7F2;color:#8A8276;font-size:12px;border-radius:0 0 6px 6px">' +
    esc_(CONFIG.NOM_BOUTIQUE) + ' · <a href="' + esc_(CONFIG.SITE) + '" style="color:#8A8276">' +
    esc_(CONFIG.SITE.replace(/^https?:\/\//, '')) + '</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}

function encadre_(titre, html) {
  return '<div style="background:#FAF7F2;border-left:3px solid #1A1A1A;padding:14px 16px;margin:18px 0;font-size:14px">' +
    '<div style="font-weight:bold;margin-bottom:6px">' + esc_(titre) + '</div>' + html + '</div>';
}

function bouton_(url, libelle, couleur) {
  return '<a href="' + esc_(url) + '" style="display:inline-block;background:' + couleur + ';color:#FFFFFF;' +
    'text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px;margin:4px 8px 4px 0">' + libelle + '</a>';
}

function boutonsDecision_(d, compact) {
  const url = urlWebApp_();
  if (!url) {
    return '<p style="color:#A3341F;font-size:13px">Boutons inactifs : déployez l’application web et renseignez CONFIG.URL_WEBAPP. ' +
      'En attendant, utilisez le menu « Dépôt-vente SEL-CT » de la feuille.</p>';
  }
  const lien = function (action) {
    return url + '?action=' + action + '&ref=' + encodeURIComponent(d.ref) + '&t=' + encodeURIComponent(d.jeton);
  };
  return bouton_(lien('approuver'), compact ? '✅ Approuver' : '✅ Approuver et envoyer la procédure', '#2F5D3A') +
    bouton_(lien('refuser'), '✖️ Refuser', '#8A8276');
}

function ligneTableau_(libelle, html) {
  return '<tr><td valign="top" style="border-bottom:1px solid #E6DED1;color:#8A8276;width:110px">' + libelle +
    '</td><td valign="top" style="border-bottom:1px solid #E6DED1">' + html + '</td></tr>';
}

function lienFeuille_() {
  try {
    const sh = feuille_();
    return '<p style="font-size:13px"><a href="' + esc_(sh.getParent().getUrl() + '#gid=' + sh.getSheetId()) +
      '" style="color:#6B645A">Ouvrir le tableau des demandes</a></p>';
  } catch (err) { return ''; }
}

function signature_() {
  return '<p style="margin-top:24px">À très bientôt,<br><b>' + esc_(CONFIG.SIGNATURE) + '</b></p>';
}

function page_(titre, contenu) {
  const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{margin:0;background:#F4EFE6;font-family:Helvetica,Arial,sans-serif;color:#1A1A1A}' +
    '.c{max-width:560px;margin:24px auto;background:#fff;border-radius:6px;padding:24px 20px}' +
    'h1{font-size:20px;margin:0 0 16px}.recap{background:#FAF7F2;border-left:3px solid #1A1A1A;padding:12px 14px;font-size:14px;margin:12px 0}' +
    'label{display:block;font-size:14px;margin:12px 0 6px;color:#6B645A}textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #D8CFC1;border-radius:4px}' +
    'button{margin-top:16px;width:100%;border:0;border-radius:4px;padding:14px;font-size:16px;font-weight:bold;color:#fff;cursor:pointer}' +
    '.ok{background:#2F5D3A}.ko{background:#8A8276}button:disabled{opacity:.6}#res{font-weight:bold;margin-top:16px}' +
    '</style></head><body><div class="c"><h1>' + esc_(titre) + '</h1>' + contenu + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titre + ' — ' + CONFIG.NOM_BOUTIQUE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// =====================================================================
// 8. OUTILS
// =====================================================================
function feuille_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Exécutez d’abord la fonction « installer ».');
  let sh = ss.getSheetByName(NOM_FEUILLE);
  if (!sh) {
    sh = ss.insertSheet(NOM_FEUILLE);
    sh.getRange(1, 1, 1, ENTETES.length).setValues([ENTETES]).setFontWeight('bold').setBackground('#F4EFE6');
    sh.setFrozenRows(1);
    sh.setColumnWidth(COL.DETAILS, 360);
    sh.hideColumns(COL.JETON);
    const regle = SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(STATUT).map(function (k) { return STATUT[k]; }), true).build();
    sh.getRange(2, COL.STATUT, 999, 1).setDataValidation(regle);
  }
  return sh;
}

function lireDemande_(ligne) {
  const v = feuille_().getRange(ligne, 1, 1, ENTETES.length).getValues()[0];
  return {
    ligne: ligne, ref: String(v[COL.REF - 1]), recue: v[COL.RECUE - 1], prenom: String(v[COL.PRENOM - 1]),
    nom: String(v[COL.NOM - 1]), email: String(v[COL.EMAIL - 1]).trim(), tel: String(v[COL.TEL - 1]),
    details: String(v[COL.DETAILS - 1]), photos: String(v[COL.PHOTOS - 1]), source: String(v[COL.SOURCE - 1]),
    statut: String(v[COL.STATUT - 1]), accuse: v[COL.ACCUSE - 1], decision: v[COL.DECISION - 1],
    note: String(v[COL.NOTE - 1]), jeton: String(v[COL.JETON - 1]),
  };
}

function majLigne_(ligne, valeurs) {
  const sh = feuille_();
  Object.keys(valeurs).forEach(function (cle) { sh.getRange(ligne, COL[cle]).setValue(valeurs[cle]); });
}

function trouverLigne_(ref) {
  const sh = feuille_();
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const refs = sh.getRange(2, COL.REF, n - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) if (String(refs[i][0]) === String(ref)) return i + 2;
  return 0;
}

function nouvelleReference_() {
  const props = PropertiesService.getScriptProperties();
  const annee = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
  const cle = 'COMPTEUR_' + annee;
  const n = Number(props.getProperty(cle) || 0) + 1;
  props.setProperty(cle, String(n));
  return 'DV-' + annee + '-' + ('000' + n).slice(-4);
}

/** Reconnaît prénom / nom / e-mail / téléphone / photos ; tout le reste devient « Détails ». */
function classerChamps_(champs) {
  const r = { prenom: '', nom: '', email: '', tel: '', photos: [], details: [] };
  Object.keys(champs).forEach(function (question) {
    const v = String(champs[question]).trim();
    if (!v) return;
    const k = sansAccents_(question).toLowerCase();
    if (!r.email && /e-?mail|courriel/.test(k) && emailValide_(v)) r.email = v;
    else if (!r.prenom && /prenom|first.?name/.test(k)) r.prenom = v;
    else if (!r.nom && (/\bnom\b|last.?name|full.?name|^name$|^votre nom/.test(k))) r.nom = v;
    else if (!r.tel && /\btel|phone|portable|mobile/.test(k)) r.tel = v;
    else if (/photo|image|fichier|piece.?jointe|upload/.test(k)) r.photos.push(v);
    else r.details.push(question + ' : ' + v);
  });
  if (!r.email) {
    Object.keys(champs).some(function (q) {
      const m = String(champs[q]).match(/[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}/i);
      if (m) r.email = m[0];
      return !!m;
    });
  }
  if (!r.prenom && r.nom.indexOf(' ') > 0) {
    r.prenom = r.nom.split(' ')[0];
    r.nom = r.nom.slice(r.prenom.length).trim();
  }
  return r;
}

function aplatirWebhook_(corps) {
  const champs = {};
  if (corps && corps.data && Array.isArray(corps.data.fields)) { // format Tally
    corps.data.fields.forEach(function (f) {
      const v = valeurTally_(f);
      if (v && (f.label || f.key)) champs[f.label || f.key] = v;
    });
    return champs;
  }
  Object.keys(corps || {}).forEach(function (cle) { // format générique { "Prénom": "…", "Email": "…" }
    if (cle === 'cle') return;
    const v = corps[cle];
    const texte = Array.isArray(v)
      ? v.map(function (x) { return x && typeof x === 'object' ? (x.url || JSON.stringify(x)) : x; }).join(', ')
      : v && typeof v === 'object' ? JSON.stringify(v) : String(v == null ? '' : v);
    if (texte.trim()) champs[cle] = texte.trim();
  });
  return champs;
}

function valeurTally_(f) {
  const v = f.value;
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) {
    return v.map(function (x) {
      if (x && typeof x === 'object') return x.url || x.name || JSON.stringify(x);
      const opt = (f.options || []).filter(function (o) { return o.id === x; })[0];
      return opt ? opt.text : String(x);
    }).join(', ');
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function champsIncomplets_() {
  const liste = [];
  if (!emailValide_(CONFIG.EMAIL_EQUIPE)) liste.push('CONFIG.EMAIL_EQUIPE');
  if (!urlWebApp_()) liste.push('CONFIG.URL_WEBAPP (après déploiement de l’application web)');
  if (String(CONFIG.CLE_WEBHOOK).indexOf('[À COMPLÉTER') !== -1) liste.push('CONFIG.CLE_WEBHOOK (seulement si formulaire externe)');
  return liste.concat(procedureIncomplete_().map(function (k) { return 'PROCEDURE.' + k; }));
}

function procedureIncomplete_() {
  return Object.keys(PROCEDURE).filter(function (k) {
    return JSON.stringify(PROCEDURE[k]).indexOf('[À COMPLÉTER') !== -1;
  });
}

function cleWebhookValide_(cle) {
  const attendue = String(CONFIG.CLE_WEBHOOK);
  return attendue.length >= 16 && attendue.indexOf('[À COMPLÉTER') === -1 && String(cle || '') === attendue;
}

function urlWebApp_() {
  if (CONFIG.URL_WEBAPP) return CONFIG.URL_WEBAPP;
  try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; }
}

function emailValide_(v) { return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(String(v || '').trim()); }
function sansAccents_(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function nl2br_(s) { return String(s).replace(/\n/g, '<br>'); }
/** Empêche qu'une réponse commençant par = + - @ soit interprétée comme une formule. */
function cellule_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
function date_(d) {
  return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy 'à' HH:mm") : '';
}
function texteBrut_(html) {
  return html.replace(/<(br|\/p|\/li|\/tr|\/div|\/h\d)[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function alerte_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { console.log(msg); }
}
