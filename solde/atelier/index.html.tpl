<title>L’Atelier comptable</title>
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
  --vert: #4a6b54;
  --sans: 'Figtree', system-ui, -apple-system, sans-serif;
  --mono: 'Geist Mono', ui-monospace, 'SF Mono', monospace;
  --r-carte: 20px;
  --r-champ: 10px;
  --r-pill: 999px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --papier: #141412; --papier-creux: #1c1b18; --papier-haut: #232220;
    --encre: #edeae1; --encre-douce: #9a958a; --trait: #302e2a;
    --accent: #4d9fff; --graphite: #b9b5aa; --terre: #d9705a; --vert: #7ea88a;
  }
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --papier: #141412; --papier-creux: #1c1b18; --papier-haut: #232220;
  --encre: #edeae1; --encre-douce: #9a958a; --trait: #302e2a;
  --accent: #4d9fff; --graphite: #b9b5aa; --terre: #d9705a; --vert: #7ea88a;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--papier); color: var(--encre); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

.chiffre { font-family: var(--mono); font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; letter-spacing: -0.01em; }
.nombre { text-align: right; white-space: nowrap; }
.surtitre { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--encre-douce); margin: 0; font-weight: 500; }
.sourdine { color: var(--encre-douce); }
.aide { font-size: 13.5px; line-height: 1.55; color: var(--encre-douce); margin: 0; }

/* ── Ossature ─────────────────────────────────────────────────────────── */
.page { max-width: 1180px; margin: 0 auto; padding: 28px 20px 96px; }

header.tete { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 22px; }
h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.025em; margin: 6px 0 0; }
.sous-titre { max-width: 56ch; font-size: 14.5px; line-height: 1.55; color: var(--encre-douce); margin: 10px 0 0; }
.tete-droite { display: flex; align-items: center; gap: 14px; }

#onglets { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 10px; border-bottom: 1px solid var(--trait); margin-bottom: 26px; scrollbar-width: thin; }
.onglet { flex: none; border: 0; background: transparent; color: var(--encre-douce); font-family: inherit; font-size: 14.5px; padding: 9px 15px; border-radius: var(--r-pill); cursor: pointer; white-space: nowrap; }
.onglet:hover { background: var(--papier-creux); color: var(--encre); }
.onglet[data-actif] { background: var(--encre); color: var(--papier); }
.onglet:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }

.colonne { display: flex; flex-direction: column; gap: 20px; }
.deux-colonnes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 20px; align-items: start; }

.carte { border: 1px solid var(--trait); border-radius: var(--r-carte); background: var(--papier-haut); padding: 20px; }
.defilant { overflow-x: auto; }
.titre-section { font-size: 19px; font-weight: 600; margin: 0; letter-spacing: -0.015em; }
.tete-etat { display: flex; flex-direction: column; gap: 8px; }

/* ── Champs ───────────────────────────────────────────────────────────── */
.champ { width: 100%; padding: 9px 11px; border: 1px solid var(--trait); border-radius: var(--r-champ); background: var(--papier); color: inherit; font-family: inherit; font-size: 14px; }
.champ:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent); }
select.champ { cursor: pointer; }
.bloc-champ { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bloc-champ.large { grid-column: 1 / -1; }
.grille-entete { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px; }

/* ── Tables ───────────────────────────────────────────────────────────── */
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; padding: 0 10px 9px 0; border-bottom: 1px solid var(--trait); font-weight: 500; }
.table th.nombre, .table th:nth-child(n+3) { text-align: right; }
.table td { padding: 9px 10px 9px 0; font-size: 13.5px; border-bottom: 1px solid color-mix(in oklab, var(--trait) 55%, transparent); vertical-align: middle; }
.table tbody tr:last-child td { border-bottom: 0; }
.table tfoot td { border-bottom: 0; border-top: 1px solid color-mix(in oklab, var(--encre) 16%, transparent); padding-top: 13px; font-weight: 500; }
.compte { white-space: nowrap; }
.libelle { min-width: 12ch; }
.debit { color: var(--graphite); }
.credit { color: var(--accent); }

.table-saisie td { padding: 5px 6px 5px 0; border-bottom: 0; }
.table-saisie th { padding-bottom: 7px; }
/* La cellule du compte se hisse au-dessus des suivantes UNIQUEMENT quand sa
   liste de suggestions est ouverte : les cellules sont peintes dans l'ordre du
   document, donc sans cela la liste passerait sous la ligne d'en dessous. Un
   z-index permanent ferait l'inverse — la cellule intercepterait les clics
   destinés aux lignes suivantes. */
.col-compte { width: 24%; min-width: 150px; position: relative; }
.col-compte[data-ouverte] { z-index: 40; }
.col-libelle { width: 32%; min-width: 130px; }
.col-montant { width: 17%; min-width: 96px; }
.col-action { width: 34px; }
.retirer { border: 0; background: transparent; color: var(--encre-douce); font-size: 19px; line-height: 1; cursor: pointer; padding: 4px 6px; border-radius: var(--r-champ); }
.retirer:hover { background: var(--papier-creux); color: var(--terre); }

/* ── Suggestions de compte ────────────────────────────────────────────── */
.enveloppe-suggestions { position: relative; }
.suggestions { position: absolute; top: calc(100% + 5px); left: 0; z-index: 40; width: min(92vw, 400px); max-height: 340px; overflow-y: auto; border: 1px solid var(--trait); border-radius: var(--r-carte); background: var(--papier-haut); box-shadow: 0 18px 40px -24px color-mix(in oklab, var(--encre) 55%, transparent); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
.suggestion { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; font-family: inherit; padding: 9px 10px; border-radius: var(--r-champ); cursor: pointer; }
.suggestion:hover, .suggestion:focus-visible { background: var(--papier-creux); outline: none; }
.suggestion-tete { display: flex; align-items: baseline; gap: 10px; }
.suggestion-numero { color: var(--accent); font-size: 13px; }
.suggestion-libelle { font-size: 13.5px; }
.suggestion-note { font-size: 12.5px; line-height: 1.45; color: var(--encre-douce); margin: 4px 0 0; }
.suggestion-piege { font-size: 12.5px; line-height: 1.45; color: var(--terre); margin: 4px 0 0; }
.suggestion-vide { font-size: 13px; color: var(--encre-douce); padding: 10px; margin: 0; }

/* ── Barre d'actions et indicateur ────────────────────────────────────── */
.barre-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--trait); }
.barre-actions.fin { justify-content: flex-end; }
.bouton { border: 0; border-radius: var(--r-pill); padding: 10px 20px; font-family: inherit; font-size: 14px; background: var(--encre); color: var(--papier); cursor: pointer; }
.bouton:disabled { opacity: 0.32; cursor: not-allowed; }
.bouton:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }
.bouton.discret { background: transparent; color: var(--encre-douce); border: 1px solid var(--trait); }
.bouton.discret:hover { color: var(--encre); border-color: var(--encre-douce); }
.lien { border: 0; background: transparent; color: var(--encre-douce); font-family: inherit; font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: var(--r-champ); text-decoration: underline; text-underline-offset: 3px; }
.lien:hover { color: var(--encre); }
.lien.danger:hover { color: var(--terre); }

.indicateur { margin-left: auto; display: flex; align-items: baseline; gap: 12px; padding: 7px 14px; border-radius: var(--r-pill); border: 1px solid var(--trait); }
.indicateur[data-etat='ok'] { border-color: color-mix(in oklab, var(--vert) 45%, transparent); background: color-mix(in oklab, var(--vert) 9%, transparent); }
.indicateur[data-etat='ko'] { border-color: color-mix(in oklab, var(--terre) 45%, transparent); background: color-mix(in oklab, var(--terre) 9%, transparent); }
.indicateur-chiffres { display: flex; align-items: baseline; gap: 7px; font-size: 13.5px; }
.indicateur-sep { color: var(--encre-douce); }
.indicateur-etat { font-size: 12.5px; color: var(--encre-douce); }
.indicateur[data-etat='ok'] .indicateur-etat { color: var(--vert); }
.indicateur[data-etat='ko'] .indicateur-etat { color: var(--terre); }

/* ── Messages ─────────────────────────────────────────────────────────── */
.zone-message:empty { display: none; }
.message { margin-top: 16px; padding: 15px 17px; border-radius: var(--r-carte); border: 1px solid var(--trait); background: var(--papier-creux); }
.message[data-ton='ok'] { border-color: color-mix(in oklab, var(--vert) 40%, transparent); background: color-mix(in oklab, var(--vert) 8%, transparent); }
.message[data-ton='ko'] { border-color: color-mix(in oklab, var(--terre) 40%, transparent); background: color-mix(in oklab, var(--terre) 8%, transparent); }
.message-titre { font-size: 14.5px; font-weight: 500; margin: 0; }
.message-texte { font-size: 13.5px; line-height: 1.6; color: var(--encre-douce); margin: 8px 0 0; }
.message-texte.corrige { color: var(--encre); }
.liste-ecarts { margin: 10px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
.liste-ecarts li { font-size: 13.5px; line-height: 1.5; color: var(--encre-douce); }

/* ── Écritures ────────────────────────────────────────────────────────── */
.ecriture-entete { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.ecriture-titre { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; font-size: 14.5px; font-weight: 500; }
.ecriture-libelle { font-weight: 500; }
.ecriture-actions { display: flex; gap: 4px; }
.etiquette { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--encre-douce); border: 1px solid var(--trait); border-radius: var(--r-pill); padding: 3px 9px; font-weight: 400; white-space: nowrap; }
.etiquette.debiteur { color: var(--graphite); }
.etiquette.crediteur { color: var(--accent); }

.total-etat { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 14px 20px; border-radius: var(--r-carte); background: var(--papier-creux); }
.total-libelle { font-size: 14px; font-weight: 500; }
.total-valeur { font-size: 17px; font-weight: 500; }

/* ── Vide ─────────────────────────────────────────────────────────────── */
.vide { border: 1px dashed var(--trait); border-radius: var(--r-carte); padding: 34px 22px; text-align: center; }
.vide-titre { font-size: 15px; margin: 0; }
.vide-texte { font-size: 13.5px; line-height: 1.55; color: var(--encre-douce); margin: 8px auto 0; max-width: 46ch; }

/* ── Exercices ────────────────────────────────────────────────────────── */
.liste-exercices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 8px; margin-top: 14px; }
.exercice { text-align: left; border: 1px solid var(--trait); border-radius: var(--r-carte); background: var(--papier); color: inherit; font-family: inherit; padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 7px; }
.exercice:hover { border-color: var(--accent); }
.exercice:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--papier), 0 0 0 4px var(--accent); }
.exercice[data-reussi] { border-color: color-mix(in oklab, var(--vert) 45%, transparent); background: color-mix(in oklab, var(--vert) 7%, transparent); }
.exercice-tete { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.exercice-titre { font-size: 14.5px; font-weight: 500; }
.exercice-enonce { font-size: 12.5px; line-height: 1.5; color: var(--encre-douce); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

.enonce { border-color: var(--accent); background: color-mix(in oklab, var(--accent) 5%, var(--papier-haut)); }
.enonce-titre { font-size: 16px; font-weight: 600; }
.enonce-texte { font-size: 14.5px; line-height: 1.65; margin: 0 0 12px; }
.indice { font-size: 13px; color: var(--encre-douce); }
.indice summary { cursor: pointer; padding: 4px 0; }

/* ── Aide TVA ─────────────────────────────────────────────────────────── */
.voile { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: color-mix(in oklab, var(--encre) 26%, transparent); }
.boite { width: min(94vw, 420px); display: flex; flex-direction: column; gap: 14px; max-height: 90vh; overflow-y: auto; }
.apercu { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: var(--r-champ); background: var(--papier-creux); }
.apercu-ligne { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; font-size: 13.5px; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }
/* ── Téléphone ────────────────────────────────────────────────────────────
   La grille de saisie ne tient pas en largeur sous 700 px : cinq colonnes,
   dont deux montants, en réclament plus de 500. Plutôt que de la faire défiler
   latéralement — insupportable pour saisir — chaque ligne devient une fiche :
   compte et libellé pleine largeur, débit et crédit côte à côte. */
@media (max-width: 700px) {
  .table-saisie thead { display: none; }
  .table-saisie, .table-saisie tbody { display: block; width: 100%; }
  .table-saisie tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    position: relative;
    border: 1px solid var(--trait);
    border-radius: var(--r-champ);
    padding: 12px 40px 12px 12px;
    margin-bottom: 10px;
  }
  .table-saisie td { display: block; padding: 0; width: auto; min-width: 0; }
  .table-saisie td::before {
    content: attr(data-intitule);
    display: block;
    margin-bottom: 5px;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--encre-douce);
  }
  .table-saisie .col-compte,
  .table-saisie .col-libelle { grid-column: 1 / -1; }
  .table-saisie .col-action { position: absolute; top: 10px; right: 8px; width: auto; }
  .table-saisie .col-action::before { content: none; }
  .suggestions { width: calc(100vw - 60px); }
}

@media (max-width: 620px) {
  .page { padding: 20px 14px 80px; }
  h1 { font-size: 25px; }
  .tete { align-items: flex-start; }
  .tete-droite { width: 100%; justify-content: space-between; }
  .indicateur { margin-left: 0; width: 100%; justify-content: space-between; }
  .barre-actions .bouton { flex: 1 1 auto; }
  .total-etat { padding: 12px 16px; }
}
</style>

<div class="page">
  <header class="tete">
    <div>
      <p class="surtitre">BTS Comptabilité et Gestion</p>
      <h1>L’Atelier comptable</h1>
      <p class="sous-titre">
        Écrivez ce que vous achetez, le compte se trouve tout seul — avec la
        raison. Le journal alimente la balance, le bilan et le compte de
        résultat, recalculés à chaque écriture. Tout reste dans ce navigateur.
      </p>
    </div>
    <div class="tete-droite">
      <span class="etiquette" id="compteur-ecritures">aucune écriture</span>
      <button type="button" class="lien danger" id="effacer">Vider le journal</button>
    </div>
  </header>

  <nav id="onglets" aria-label="Sections de l’atelier"></nav>
  <main id="scene"></main>
</div>

<script>__BUNDLE__</script>
