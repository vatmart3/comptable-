<title>La Ligne et La Balance</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" />
<style>

:root {
  color-scheme: light;
  --papier: #f7f5f1;
  --papier-creux: #efede7;
  --papier-haut: #fbfaf7;
  --encre: #16150f;
  --encre-douce: #6e6a5f;
  --trait: #e2dfd6;
  --accent: #0071e3;
  --graphite: #3a3a38;
  --terre: #c4553b;
  --vert-sourd: #4a6b54;
  --sans: 'Figtree', system-ui, -apple-system, sans-serif;
  --mono: 'Geist Mono', ui-monospace, 'SF Mono', monospace;
  --r-carte: 28px;
  --r-champ: 16px;
  --r-pill: 999px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --papier: #141412;
    --papier-creux: #1c1b18;
    --papier-haut: #232220;
    --encre: #edeae1;
    --encre-douce: #9a958a;
    --trait: #302e2a;
    --accent: #4d9fff;
    --graphite: #b9b5aa;
    --terre: #d9705a;
    --vert-sourd: #7ea88a;
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --papier: #141412;
  --papier-creux: #1c1b18;
  --papier-haut: #232220;
  --encre: #edeae1;
  --encre-douce: #9a958a;
  --trait: #302e2a;
  --accent: #4d9fff;
  --graphite: #b9b5aa;
  --terre: #d9705a;
  --vert-sourd: #7ea88a;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--papier);
  color: var(--encre);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}

.page {
  max-width: 92ch;
  margin: 0 auto;
  padding: 64px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.chiffre {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.01em;
}

.surtitre {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--encre-douce);
  margin: 0;
}

h1 {
  font-size: clamp(38px, 8vw, 64px);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 0.98;
  margin: 20px 0 0;
  text-wrap: balance;
}

.chapeau { max-width: 46ch; font-size: 16px; line-height: 1.6; color: var(--encre-douce); margin: 20px 0 0; }
.chapeau strong { color: var(--encre); font-weight: 500; }

.entete { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.balance { width: 220px; height: 180px; flex: none; }

/* ── La Ligne ─────────────────────────────────────────────────────────── */
#ligne {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font-family: inherit;
  font-size: clamp(22px, 4.4vw, 32px);
  line-height: 1.3;
  letter-spacing: -0.01em;
  caret-color: var(--accent);
}
#ligne::placeholder { color: var(--trait); }
#ligne:focus { outline: none; }
.filet { height: 1px; background: var(--trait); margin-top: 16px; transition: background-color 180ms, height 180ms; }
#ligne:focus + .filet { height: 2px; background: var(--accent); }

/* ── Puces ────────────────────────────────────────────────────────────── */
#puces { display: flex; flex-wrap: wrap; gap: 8px; }
.puce {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 14px;
  border-radius: var(--r-pill);
  border: 1px solid color-mix(in oklab, var(--encre-douce) 26%, transparent);
  background: color-mix(in oklab, var(--encre-douce) 8%, transparent);
  font-size: 14px;
}
.puce[data-deduite] { border-style: dashed; border-color: var(--trait); }
.puce[data-editable] { cursor: pointer; }
.puce[data-editable]:hover { border-color: color-mix(in oklab, var(--accent) 50%, transparent); }
.puce:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }
.puce .surtitre { font-size: 10px; }
.puce[data-kind='compte'] { border-color: color-mix(in oklab, var(--accent) 32%, transparent); background: color-mix(in oklab, var(--accent) 8%, transparent); }
.puce[data-kind='compte'] .valeur { color: var(--accent); }
.puce[data-kind='tva'] { border-color: color-mix(in oklab, var(--vert-sourd) 32%, transparent); background: color-mix(in oklab, var(--vert-sourd) 8%, transparent); }
.puce[data-kind='tva'] .valeur { color: var(--vert-sourd); }
.puce[data-kind='tiers'] { border-color: color-mix(in oklab, var(--terre) 32%, transparent); background: color-mix(in oklab, var(--terre) 8%, transparent); }
.puce[data-kind='tiers'] .valeur { color: var(--terre); }

/* ── Panneau d'édition d'une puce ─────────────────────────────────────── */
.panneau {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: min(88vw, 340px);
  padding: 20px;
  border-radius: var(--r-carte);
  border: 1px solid var(--trait);
  background: var(--papier-haut);
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: default;
}
.titre-panneau { margin-bottom: 4px; }
.saisie-panneau {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--r-champ);
  border: 1px solid var(--trait);
  background: var(--papier);
  color: inherit;
  font-size: 14px;
}
.saisie-panneau:focus-visible { outline: none; border-color: var(--accent); }
.liste { display: flex; flex-direction: column; max-height: 220px; overflow-y: auto; }
.option {
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: var(--r-champ);
  cursor: pointer;
}
.option:hover { background: var(--papier-creux); }
.option[data-courante] { color: var(--accent); }
.aide { font-size: 12px; color: var(--encre-douce); margin: 0; }

#raison { font-size: 14px; line-height: 1.5; color: var(--encre-douce); margin: 0; }

/* ── Écriture ─────────────────────────────────────────────────────────── */
.carte {
  border: 1px solid var(--trait);
  border-radius: var(--r-carte);
  background: var(--papier-haut);
  padding: 24px;
}
.defilant { overflow-x: auto; }
table { width: 100%; min-width: 34rem; border-collapse: collapse; }
caption { text-align: left; margin-bottom: 20px; }
th { font-weight: 400; padding-bottom: 12px; border-bottom: 1px solid var(--trait); }
th.a-droite, td.montant { text-align: right; }
td { padding: 12px 16px 12px 0; font-size: 14px; border-bottom: 1px solid color-mix(in oklab, var(--trait) 60%, transparent); }
tbody tr:last-child td { border-bottom: 0; }
td.debit { color: var(--graphite); }
td.credit { color: var(--accent); }
td.libelle { max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
tfoot td { border-bottom: 0; border-top: 1px solid color-mix(in oklab, var(--encre) 15%, transparent); padding-top: 16px; font-weight: 500; }
tfoot td:first-child { font-weight: 400; font-size: 13px; color: var(--encre-douce); }

/* ── Validation ───────────────────────────────────────────────────────── */
.pied { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
#valider {
  border: 0;
  border-radius: var(--r-pill);
  padding: 13px 26px;
  font-family: inherit;
  font-size: 15px;
  background: var(--encre);
  color: var(--papier);
  cursor: pointer;
}
#valider:disabled { opacity: 0.35; cursor: not-allowed; }
#valider:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }
#valider .touche { opacity: 0.6; margin-left: 12px; }
#note-serveur { font-size: 14px; line-height: 1.5; color: var(--vert-sourd); margin: 0; max-width: 44ch; }

/* ── Exemples ─────────────────────────────────────────────────────────── */
.exemples { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
[data-exemple] {
  border: 0;
  background: transparent;
  color: var(--encre-douce);
  font-family: inherit;
  font-size: 15px;
  text-align: left;
  padding: 8px 12px;
  border-radius: var(--r-champ);
  cursor: pointer;
}
[data-exemple]:hover { background: var(--papier-creux); color: var(--encre); }
[data-exemple]:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }

/* ── Pied de page ─────────────────────────────────────────────────────── */
.colonnes { display: grid; grid-template-columns: repeat(auto-fit, minmax(26ch, 1fr)); gap: 32px; }
.colonnes h2 { font-size: 15px; font-weight: 500; margin: 0 0 10px; }
.colonnes ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
.colonnes li { font-size: 14px; line-height: 1.5; color: var(--encre-douce); }
hr { border: 0; border-top: 1px solid var(--trait); margin: 0; }

.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
</style>

<div class="page">
  <header class="entete">
    <div>
      <p class="surtitre">SOLDE · essai de la Phase 1</p>
      <h1>La Ligne<br />et La Balance</h1>
      <p class="chapeau">
        Décrivez une opération en français : elle devient une écriture
        équilibrée. La balance pèse ce qui est déjà connu — un montant sans
        imputation la fait pencher à fond, et la validation reste fermée.
      </p>
      <p class="chapeau">
        <strong>C’est le code de production qui tourne ici</strong>, pas une
        maquette. Il manque le serveur, qui numérote et chaîne.
      </p>
    </div>

    <svg class="balance" viewBox="0 0 220 180" aria-hidden="true" focusable="false">
      <ellipse cx="110" cy="162" rx="34" ry="7" fill="var(--graphite)" />
      <rect x="106" y="52" width="8" height="106" rx="4" fill="var(--graphite)" />
      <circle id="temoin" cx="110" cy="46" r="7" fill="var(--vert-sourd)" />
      <g id="fleau">
        <rect x="34" y="53" width="152" height="6" rx="3" fill="var(--graphite)" />
        <circle cx="38" cy="56" r="4" fill="var(--graphite)" />
        <circle cx="182" cy="56" r="4" fill="var(--graphite)" />
      </g>
      <g id="plateau-gauche">
        <line x1="38" y1="56" x2="20" y2="96" stroke="var(--graphite)" stroke-width="1.5" />
        <line x1="38" y1="56" x2="56" y2="96" stroke="var(--graphite)" stroke-width="1.5" />
        <ellipse cx="38" cy="98" rx="22" ry="5" fill="var(--encre-douce)" />
      </g>
      <g id="plateau-droit">
        <line x1="182" y1="56" x2="164" y2="96" stroke="var(--graphite)" stroke-width="1.5" />
        <line x1="182" y1="56" x2="200" y2="96" stroke="var(--graphite)" stroke-width="1.5" />
        <ellipse cx="182" cy="98" rx="22" ry="5" fill="var(--encre-douce)" />
      </g>
    </svg>
  </header>

  <div>
    <label class="sr" for="ligne">Décrivez l’opération</label>
    <input id="ligne" autocomplete="off" spellcheck="false"
           value="payé 240 € gasoil Total CB hier"
           placeholder="payé 240 € gasoil Total CB hier" />
    <div class="filet"></div>
  </div>

  <section aria-label="Éléments reconnus" style="display: flex; flex-direction: column; gap: 20px">
    <div id="puces"></div>
    <p id="raison"></p>
  </section>

  <section id="ecriture" class="carte defilant" aria-label="Écriture proposée" hidden>
    <table>
      <caption class="surtitre" id="journal-entete"></caption>
      <thead>
        <tr>
          <th class="surtitre" scope="col" style="text-align: left">Compte</th>
          <th class="surtitre" scope="col" style="text-align: left">Libellé</th>
          <th class="surtitre a-droite" scope="col">Débit</th>
          <th class="surtitre a-droite" scope="col">Crédit</th>
        </tr>
      </thead>
      <tbody id="lignes"></tbody>
      <tfoot>
        <tr>
          <td colspan="2" id="etat-equilibre"></td>
          <td class="chiffre montant" id="total-debit">0,00</td>
          <td class="chiffre montant" id="total-credit">0,00</td>
        </tr>
      </tfoot>
    </table>
  </section>

  <div class="pied">
    <button type="button" id="valider" disabled>Valider<span class="chiffre touche">⏎</span></button>
    <p id="note-serveur" role="status"></p>
  </div>

  <p class="sr" id="annonce" role="status" aria-live="polite"></p>

  <section aria-label="Exemples">
    <p class="surtitre" style="margin-bottom: 12px">Essayez</p>
    <div class="exemples">
      <button type="button" data-exemple="encaissé 1 800 € prestation Méridien virement">encaissé 1 800 € prestation Méridien virement</button>
      <button type="button" data-exemple="facture de 96 € Orange abonnement">facture de 96 € Orange abonnement</button>
      <button type="button" data-exemple="payé 42,50 € restaurant CB vendredi">payé 42,50 € restaurant CB vendredi</button>
      <button type="button" data-exemple="payé 1 200 € ordinateur CB le 3 mars">payé 1 200 € ordinateur CB le 3 mars</button>
      <button type="button" data-exemple="payé 105,50 € fournitures CB tva 5,5">payé 105,50 € fournitures CB tva 5,5</button>
      <button type="button" data-exemple="payé 240 € CB hier">payé 240 € CB hier — sans imputation, la balance penche</button>
    </div>
  </section>

  <hr />

  <section class="colonnes">
    <div>
      <h2>Ce qui tourne vraiment ici</h2>
      <ul>
        <li>L’analyse de la phrase : montants, dates relatives, mode de règlement, tiers, taux de TVA, imputation.</li>
        <li>Les 205 comptes du Plan Comptable Général, avec leur taux de TVA attendu.</li>
        <li>La construction de l’écriture — équilibrée par construction, jamais ligne à ligne.</li>
        <li>La physique de la balance : ressort raideur 260, amortissement 30, intégré image par image.</li>
        <li>Les montants en entiers de centimes : aucun flottant ne traverse une écriture.</li>
      </ul>
    </div>
    <div>
      <h2>Ce qui manque, faute de serveur</h2>
      <ul>
        <li>La numérotation continue par journal et par exercice.</li>
        <li>Le chaînage SHA-256 qui rend le registre inaltérable.</li>
        <li>La balance 3D en R3F — ici, la version dessinée, celle que reçoit qui a demandé que rien ne bouge.</li>
        <li>La palette ⌘K, le grand livre, la TVA, la clôture.</li>
      </ul>
    </div>
  </section>
</div>

<script>__BUNDLE__</script>
