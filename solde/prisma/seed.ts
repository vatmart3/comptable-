/**
 * Seed — société de démonstration.
 *
 * Crée l'espace d'une société fictive, son plan comptable complet, ses
 * journaux, ses exercices, puis douze mois d'écritures crédibles.
 *
 * Ces écritures passent par le SERVICE de validation, une par une, exactement
 * comme une saisie humaine : contrôle d'équilibre, numérotation continue,
 * chaînage cryptographique. Les insérer directement en base irait cent fois
 * plus vite et produirait un registre non chaîné — donc un registre faux, que
 * `npm run solde:verify` rejetterait aussitôt.
 */

import { PrismaClient } from '@prisma/client'
import { JOURNAUX, PCG } from './data/pcg'
import { genererDemo } from './data/demo'
import { accountClass, accountNature, isLettrable, naturalSide } from '../lib/accounting/account'
import { creerBrouillon, validerEcriture } from '../lib/server/entries'
import type { Contexte } from '../lib/server/context'

const db = new PrismaClient()

const SIRET = '81234567800019'

async function main(): Promise<void> {
  console.log('→ Société')
  const company = await db.company.upsert({
    where: { siret: SIRET },
    update: {},
    create: {
      nom: 'Atelier Vaugirard',
      siret: SIRET,
      siren: SIRET.slice(0, 9),
      formeJuridique: 'SARL',
      adresse: '14 rue de Vaugirard',
      codePostal: '75006',
      ville: 'Paris',
      categorieRevenu: 'BIC',
      regimeImposition: 'reel_normal',
      regimeTva: 'reel_normal',
      exigibiliteTva: 'debits',
      numeroTvaIntra: 'FR40812345678',
      devise: 'EUR',
    },
  })

  // L'exercice ouvert est l'année en cours : une démo doit vivre dans le
  // présent, sinon « hier » tombe hors exercice et rien ne se valide.
  const anneeCourante = new Date().getUTCFullYear()

  console.log('→ Exercices')
  for (const annee of [anneeCourante - 1, anneeCourante]) {
    await db.fiscalYear.upsert({
      where: { companyId_dateDebut: { companyId: company.id, dateDebut: new Date(Date.UTC(annee, 0, 1)) } },
      update: {},
      create: {
        companyId: company.id,
        libelle: `Exercice ${annee}`,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
        statut: annee === anneeCourante ? 'ouvert' : 'cloture',
        reportANouveauGenere: annee < anneeCourante,
        clotureLe: annee < anneeCourante ? new Date(Date.UTC(anneeCourante, 3, 30)) : null,
      },
    })
  }

  console.log(`→ Plan comptable (${PCG.length} comptes)`)
  for (const compte of PCG) {
    const data = {
      companyId: company.id,
      numero: compte.numero,
      libelle: compte.libelle,
      classe: accountClass(compte.numero),
      nature: accountNature(compte.numero),
      sensNaturel: naturalSide(compte.numero),
      lettrable: isLettrable(compte.numero),
      auxiliaire: false,
      actif: true,
      tauxTvaAttendu: compte.tauxTva ?? null,
    }
    await db.account.upsert({
      where: { companyId_numero: { companyId: company.id, numero: compte.numero } },
      update: data,
      create: data,
    })
  }

  console.log('→ Journaux')
  for (const journal of JOURNAUX) {
    const contrepartie = journal.compteContrepartie
      ? await db.account.findUnique({
          where: { companyId_numero: { companyId: company.id, numero: journal.compteContrepartie } },
        })
      : null
    await db.journal.upsert({
      where: { companyId_code: { companyId: company.id, code: journal.code } },
      update: { libelle: journal.libelle, type: journal.type, compteContrepartieId: contrepartie?.id ?? null },
      create: {
        companyId: company.id,
        code: journal.code,
        libelle: journal.libelle,
        type: journal.type,
        compteContrepartieId: contrepartie?.id ?? null,
      },
    })
  }

  console.log('→ Compte bancaire')
  const compteBanque = await db.account.findUnique({
    where: { companyId_numero: { companyId: company.id, numero: '512000' } },
  })
  await db.bankAccount.upsert({
    where: { companyId_iban: { companyId: company.id, iban: 'FR7630004000031234567890143' } },
    update: {},
    create: {
      companyId: company.id,
      libelle: 'Compte courant',
      banque: 'BNP Paribas',
      iban: 'FR7630004000031234567890143',
      bic: 'BNPAFRPP',
      soldeInitial: 1_850_000,
      compteId: compteBanque?.id ?? null,
    },
  })

  console.log('→ Tiers')
  const collectifClient = await db.account.findUnique({
    where: { companyId_numero: { companyId: company.id, numero: '411000' } },
  })
  const collectifFournisseur = await db.account.findUnique({
    where: { companyId_numero: { companyId: company.id, numero: '401000' } },
  })

  const tiers = [
    { code: 'CLIMERIDIEN', nom: 'Méridien Studio', type: 'client', delai: 30 },
    { code: 'CLIBASTIDE', nom: 'Bastide & Fils', type: 'client', delai: 45 },
    { code: 'CLINOVEA', nom: 'Novéa Conseil', type: 'client', delai: 30 },
    { code: 'FOUTOTAL', nom: 'Total Énergies', type: 'fournisseur', delai: 30 },
    { code: 'FOUORANGE', nom: 'Orange Business', type: 'fournisseur', delai: 30 },
    { code: 'FOUSCI', nom: 'SCI du Cherche-Midi', type: 'fournisseur', delai: 0 },
    { code: 'FOUPAPETERIE', nom: 'Papeterie Saint-Placide', type: 'fournisseur', delai: 30 },
  ] as const

  for (const partenaire of tiers) {
    await db.partner.upsert({
      where: { companyId_code: { companyId: company.id, code: partenaire.code } },
      update: {},
      create: {
        companyId: company.id,
        code: partenaire.code,
        nom: partenaire.nom,
        type: partenaire.type,
        delaiReglement: partenaire.delai,
        modeReglement: partenaire.delai === 0 ? 'date_facture' : 'fin_de_mois',
        compteClientId: partenaire.type === 'client' ? (collectifClient?.id ?? null) : null,
        compteFournisseurId:
          partenaire.type === 'fournisseur' ? (collectifFournisseur?.id ?? null) : null,
      },
    })
  }

  console.log('→ Analytique')
  const axe = await db.analyticAxis.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ACT' } },
    update: {},
    create: { companyId: company.id, code: 'ACT', libelle: 'Activité', obligatoire: false },
  })
  for (const section of [
    { code: 'CONSEIL', libelle: 'Conseil' },
    { code: 'PROD', libelle: 'Production' },
    { code: 'STRUCT', libelle: 'Structure' },
  ]) {
    await db.analyticSection.upsert({
      where: { axisId_code: { axisId: axe.id, code: section.code } },
      update: {},
      create: { axisId: axe.id, code: section.code, libelle: section.libelle },
    })
  }

  console.log('→ Utilisateurs')
  const utilisateurs = [
    { email: 'camille@atelier-vaugirard.fr', name: 'Camille Roux', role: 'expert' },
    { email: 'sofiane@atelier-vaugirard.fr', name: 'Sofiane Berger', role: 'reviseur' },
    { email: 'lou@atelier-vaugirard.fr', name: 'Lou Marchand', role: 'saisie' },
  ] as const

  for (const utilisateur of utilisateurs) {
    const user = await db.user.upsert({
      where: { email: utilisateur.email },
      update: { name: utilisateur.name },
      create: { email: utilisateur.email, name: utilisateur.name, emailVerified: true },
    })
    await db.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { role: utilisateur.role },
      create: { userId: user.id, companyId: company.id, role: utilisateur.role },
    })
  }

  // ── Douze mois d'écritures, validées par le service ─────────────────────
  const exerciceCourant = await db.fiscalYear.findFirstOrThrow({
    where: { companyId: company.id, statut: 'ouvert' },
  })
  const dejaSaisi = await db.entry.count({ where: { fiscalYearId: exerciceCourant.id } })

  if (dejaSaisi > 0) {
    console.log(`→ Écritures : ${dejaSaisi} déjà présentes, génération ignorée`)
  } else {
    const expert = await db.membership.findFirstOrThrow({
      where: { companyId: company.id, role: 'expert' },
      include: { user: true },
    })
    const contexte: Contexte = {
      companyId: company.id,
      companyNom: company.nom,
      siren: company.siren,
      fiscalYearId: exerciceCourant.id,
      exercice: {
        dateDebut: exerciceCourant.dateDebut,
        dateFin: exerciceCourant.dateFin,
        statut: 'ouvert',
      },
      acteur: {
        userId: expert.user.id,
        nom: expert.user.name,
        email: expert.user.email,
        role: 'expert',
      },
    }

    const ecritures = genererDemo(exerciceCourant.dateDebut.getUTCFullYear(), new Date())
    console.log(`→ Écritures (${ecritures.length}, validées et chaînées une par une)`)
    let posees = 0
    for (const ecriture of ecritures) {
      const brouillon = await creerBrouillon(contexte, {
        journalCode: ecriture.journalCode,
        date: ecriture.date,
        libelle: ecriture.libelle,
        pieceRef: ecriture.pieceRef,
        origine: ecriture.journalCode === 'AN' ? 'anouveaux' : 'import',
        lines: ecriture.lines,
      })
      await validerEcriture(contexte, brouillon.id)
      posees += 1
      if (posees % 40 === 0) console.log(`   ${posees}/${ecritures.length}`)
    }
  }

  const comptes = await db.account.count({ where: { companyId: company.id } })
  const validees = await db.entry.count({ where: { companyId: company.id, statut: 'validee' } })
  console.log(
    `\n✓ ${company.nom} — ${comptes} comptes, ${JOURNAUX.length} journaux, 2 exercices, ${validees} écritures validées.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.$disconnect()
  })
