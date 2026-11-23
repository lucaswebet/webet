/**
 * Simulation locale de Code.gs (Google Sheets / Gmail / Apps Script imités en mémoire).
 * Vérifie le parcours complet et génère apercu-emails.html.
 *   node automations/depot-vente-selct/outils/simulation.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = path.join(__dirname, '..');
let source = fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8');
// Configuration de test (le fichier réel garde ses « [À COMPLÉTER] »)
const cfgTest = source
  .replace("EMAIL_EQUIPE: '[À COMPLÉTER]'", "EMAIL_EQUIPE: 'equipe@exemple.fr'")
  .replace("URL_WEBAPP: ''", "URL_WEBAPP: 'https://script.google.com/macros/s/EXEMPLE/exec'")
  .replace("CLE_WEBHOOK: '[À COMPLÉTER]'", "CLE_WEBHOOK: 'cle-secrete-de-test-123456'");
const procTest = cfgTest.replace(/'\[À COMPLÉTER — ([^\]]+)\]'/g, (m, txt) => JSON.stringify('(exemple) ' + txt));

// ---------- Mocks Apps Script ----------
function creerMonde() {
  const envoyes = [];
  const props = {};
  const grille = []; // tableau de lignes (1-indexées via helpers)
  const sheet = {
    getName: () => 'Demandes', getSheetId: () => 42, getParent: () => ss,
    getLastRow: () => grille.length,
    appendRow: (row) => grille.push(row.slice()),
    insertSheet: null,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((grille[r - 1 + i] || [])[c - 1 + j] ?? ''))),
      setValue: (v) => { grille[r - 1] = grille[r - 1] || []; grille[r - 1][c - 1] = v; },
      setValues: (vals) => { vals.forEach((row, i) => { grille[r - 1 + i] = row.slice(); }); return chain; },
      setDataValidation: () => chain, getRow: () => r,
    }),
    setFrozenRows() {}, setColumnWidth() {}, hideColumns() {},
  };
  const chain = { setFontWeight: () => chain, setBackground: () => chain };
  let feuilleCreee = false;
  const ss = {
    getId: () => 'SS1', getUrl: () => 'https://docs.google.com/spreadsheets/d/SS1/edit',
    getSheetByName: () => (feuilleCreee ? sheet : null),
    insertSheet: () => { feuilleCreee = true; return sheet; },
  };
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, openById: () => ss,
      getUi: () => { throw new Error('pas d’UI'); },
      newDataValidation: () => ({ requireValueInList: () => ({ build: () => ({}) }) }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => require('crypto').randomUUID(),
      formatDate: (d, tz, f) => (f === 'yyyy' ? String(d.getFullYear()) : d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })),
    },
    Session: { getScriptTimeZone: () => 'Europe/Paris' },
    GmailApp: { sendEmail: (a, sujet, texte, o) => envoyes.push({ a, sujet, texte, html: o.htmlBody, replyTo: o.replyTo }) },
    ScriptApp: { getService: () => ({ getUrl: () => '' }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; } }) },
    ContentService: { createTextOutput: (t) => ({ texte: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  };
  return { ctx, envoyes, grille, props };
}

function charger(code) {
  const m = creerMonde();
  vm.createContext(m.ctx);
  vm.runInContext(code + '\nthis.__ = { CONFIG, PROCEDURE, STATUT, COL, enregistrerDemande_, deciderDemande_, doGet, doPost, executerDecisionWeb, surSoumissionFormulaire, rappelDemandesEnAttente, classerChamps_, aplatirWebhook_, procedureIncomplete_, lireDemande_ };', m.ctx);
  return Object.assign(m, m.ctx.__);
}

// ---------- Scénarios ----------
let ok = 0;
const t = (nom, fn) => { fn(); ok++; console.log('✓ ' + nom); };

// A. Fichier livré : procédure non remplie → l'approbation est bloquée
{
  const w = charger(cfgTest);
  const ref = w.enregistrerDemande_({ 'Prénom': 'Léa', 'Nom': 'Martin', 'Adresse e-mail': 'lea@exemple.fr', 'Articles': 'Veste' }, 'Test');
  t('procédure incomplète → approbation refusée sans e-mail', () => {
    const avant = w.envoyes.length;
    assert.throws(() => w.deciderDemande_(ref, 'approuver', ''), /Procédure incomplète/);
    assert.strictEqual(w.envoyes.length, avant);
  });
}

// B. Parcours complet avec procédure remplie
const w = charger(procTest);
let ref1;
t('Google Form : demande enregistrée + accusé 48 h + notification équipe', () => {
  const e = { range: { getRow: () => 2 }, namedValues: {
    'Horodateur': ['23/11/2026 10:00'], 'Prénom': ['Léa'], 'Nom': ['Martin'], 'Adresse e-mail': ['lea@exemple.fr'],
    'Numéro de téléphone': ['06 12 34 56 78'], 'Marques et articles proposés': ['Pull Lacoste bleu marine (M)\nChemise Ralph Lauren blanche (L)'],
    'Nombre de pièces': ['2'], 'État': ['Très bon état'], 'Photos des articles': ['https://drive.google.com/open?id=a, https://drive.google.com/open?id=b'],
  } };
  w.surSoumissionFormulaire(e);
  const d = w.lireDemande_(2);
  ref1 = d.ref;
  assert.match(d.ref, /^DV-\d{4}-0001$/);
  assert.strictEqual(d.prenom, 'Léa'); assert.strictEqual(d.nom, 'Martin'); assert.strictEqual(d.tel, '06 12 34 56 78');
  assert.strictEqual(d.statut, w.STATUT.EN_ETUDE);
  assert.ok(!/Horodateur/.test(d.details));
  assert.strictEqual(w.envoyes.length, 2);
  assert.strictEqual(w.envoyes[0].a, 'lea@exemple.fr');
  assert.match(w.envoyes[0].html, /traitée dans les 48 heures/);
  assert.strictEqual(w.envoyes[1].a, 'equipe@exemple.fr');
  assert.strictEqual(w.envoyes[1].replyTo, 'lea@exemple.fr');
  assert.match(w.envoyes[1].html, /action=approuver&amp;ref=DV-/);
});

t('Appel forgé de surSoumissionFormulaire refusé', () => {
  assert.throws(() => w.surSoumissionFormulaire({ namedValues: { 'Adresse e-mail': ['x@y.fr'] } }), /non autorisé/);
});

t('Lien e-mail : mauvais jeton → page « Lien invalide », bon jeton → page de confirmation (aucun envoi)', () => {
  const d = w.lireDemande_(2);
  assert.match(w.doGet({ parameter: { action: 'approuver', ref: d.ref, t: 'faux' } }).html, /Lien invalide/);
  const avant = w.envoyes.length;
  const page = w.doGet({ parameter: { action: 'approuver', ref: d.ref, t: d.jeton } }).html;
  assert.match(page, /Confirmer et envoyer la procédure/);
  assert.strictEqual(w.envoyes.length, avant);
  assert.throws(() => w.executerDecisionWeb(d.ref, 'approuver', 'faux', ''), /Lien invalide/);
});

t('Approbation : procédure envoyée, statut mis à jour, pas de double envoi', () => {
  const d = w.lireDemande_(2);
  const msg = w.executerDecisionWeb(d.ref, 'approuver', d.jeton, 'Hâte de voir vos pièces !');
  assert.match(msg, /approuvée/);
  const dernier = w.envoyes[w.envoyes.length - 1];
  assert.strictEqual(dernier.a, 'lea@exemple.fr');
  assert.match(dernier.sujet, /accepté — procédure/);
  assert.match(dernier.html, /Hâte de voir vos pièces/);
  assert.strictEqual(w.lireDemande_(2).statut, w.STATUT.APPROUVEE);
  const n = w.envoyes.length;
  assert.match(w.executerDecisionWeb(d.ref, 'approuver', d.jeton, ''), /déjà/);
  assert.match(w.doGet({ parameter: { action: 'refuser', ref: d.ref, t: d.jeton } }).html, /Déjà traitée/);
  assert.strictEqual(w.envoyes.length, n);
});

t('Webhook Tally : clé obligatoire, champs + fichiers reconnus', () => {
  const tally = { eventType: 'FORM_RESPONSE', data: { fields: [
    { key: 'q1', label: 'Nom complet', type: 'INPUT_TEXT', value: 'Sami Ben Ali' },
    { key: 'q2', label: 'Email', type: 'INPUT_EMAIL', value: 'sami@exemple.fr' },
    { key: 'q3', label: 'Type de vêtements', type: 'MULTIPLE_CHOICE', value: ['o1', 'o2'], options: [{ id: 'o1', text: 'Vestes' }, { id: 'o2', text: 'Pulls' }] },
    { key: 'q4', label: 'Photos', type: 'FILE_UPLOAD', value: [{ url: 'https://storage.tally.so/p1.jpg', name: 'p1.jpg' }] },
    { key: 'q5', label: 'Message', type: 'TEXTAREA', value: '=HYPERLINK("http://x")' },
  ] } };
  const corps = { postData: { contents: JSON.stringify(tally) } };
  assert.match(w.doPost(Object.assign({ parameter: { cle: 'mauvaise' } }, corps)).texte, /clé invalide/);
  const rep = JSON.parse(w.doPost(Object.assign({ parameter: { cle: 'cle-secrete-de-test-123456' } }, corps)).texte);
  assert.ok(rep.ok, rep.erreur);
  assert.match(rep.reference, /-0002$/);
  const d = w.lireDemande_(3);
  assert.strictEqual(d.prenom, 'Sami'); assert.strictEqual(d.nom, 'Ben Ali');
  assert.match(d.details, /Vestes, Pulls/);
  assert.match(d.details, /Message : =HYPERLINK/); // stockée en texte (préfixe ' appliqué seulement en début de cellule)
  assert.strictEqual(d.photos, 'https://storage.tally.so/p1.jpg');
});

t('Refus depuis la feuille + échappement HTML des réponses', () => {
  w.enregistrerDemande_({ 'Prénom': '<script>x</script>', 'E-mail': 'z@exemple.fr', 'Articles': '<b>gras</b>' }, 'Test');
  const notif = w.envoyes[w.envoyes.length - 1];
  assert.ok(!/<script>x/.test(notif.html) && /&lt;script&gt;/.test(notif.html));
  const d = w.lireDemande_(4);
  assert.match(w.deciderDemande_(d.ref, 'refuser', 'Catégorie non prise actuellement.'), /refusée/);
  assert.strictEqual(w.lireDemande_(4).statut, w.STATUT.REFUSEE);
});

t('Formule en début de cellule neutralisée', () => {
  w.enregistrerDemande_({ 'Prénom': '=1+1', 'E-mail': 'f@exemple.fr' }, 'Test');
  assert.strictEqual(w.grille[4][2], "'=1+1");
});

t('Rappel quotidien : seules les demandes ouvertes > 24 h', () => {
  w.grille[4][w.COL.RECUE - 1] = new Date(Date.now() - 50 * 3600e3);
  const n = w.envoyes.length;
  w.rappelDemandesEnAttente();
  assert.strictEqual(w.envoyes.length, n + 1);
  const r = w.envoyes[w.envoyes.length - 1];
  assert.match(r.sujet, /1 demande/);
  assert.match(r.html, /délai de 48 h dépassé/);
});

// ---------- Aperçu ----------
const choisir = (re) => w.envoyes.find((m) => re.test(m.sujet));
const apercus = [
  ['1 · Accusé de réception (au déposant, automatique)', choisir(/bien reçu/)],
  ['2 · Notification équipe avec boutons', choisir(/^Nouvelle demande/)],
  ['3 · Procédure après approbation (au déposant)', choisir(/accepté/)],
  ['4 · Refus (au déposant)', choisir(/^Votre demande de dépôt-vente \(/)],
  ['5 · Rappel quotidien (à l’équipe)', choisir(/en attente/)],
];
const page = w.doGet({ parameter: { action: 'approuver', ref: ref1, t: '' } }); // lien incomplet → montre le style
const conf = (() => { const d = w.lireDemande_(3); return w.doGet({ parameter: { action: 'approuver', ref: d.ref, t: d.jeton } }).html; })();
const blocs = apercus.map(([titre, m]) =>
  `<section><h2>${titre}</h2><p class="s"><b>Objet :</b> ${m.sujet.replace(/</g, '&lt;')}</p>` +
  `<iframe srcdoc="${m.html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></section>`).join('') +
  `<section><h2>6 · Page de confirmation (après clic sur « Approuver »)</h2>` +
  `<iframe srcdoc="${conf.replace(/<script>[\s\S]*?<\/script>/, '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></section>`;
fs.writeFileSync(path.join(DIR, 'apercu-emails.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>Aperçu e-mails dépôt-vente</title><style>body{margin:0;padding:16px;background:#E9E4DB;font-family:Helvetica,Arial,sans-serif;color:#1A1A1A}` +
  `h1{font-size:22px}h2{font-size:16px;margin:28px 0 4px}.s{margin:0 0 8px;font-size:14px;color:#555}` +
  `iframe{width:100%;max-width:640px;height:820px;border:1px solid #CFC6B8;border-radius:6px;background:#fff;display:block}` +
  `.n{background:#FFF7E0;border:1px solid #E8D9A8;padding:10px 12px;border-radius:4px;font-size:14px;max-width:616px}</style></head><body>` +
  `<h1>SEL-CT Wear — aperçu des e-mails de dépôt-vente</h1><p class="n">Données fictives. Les textes « (exemple) … » de la procédure ` +
  `sont à remplacer par vos vraies conditions dans <code>PROCEDURE</code> (Code.gs).</p>${blocs}</body></html>`);

void page;
console.log(`\n${ok} vérifications réussies — aperçu : automations/depot-vente-selct/apercu-emails.html`);
