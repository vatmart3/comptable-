/**
 * Seed — Phase 0.
 *
 * Crée l'espace d'une société fictive, son plan comptable complet, ses
 * journaux et ses exercices. Les douze mois d'écritures crédibles annoncés
 * au § 9 arriveront avec la Phase 1 : ils doivent passer par le service de
 * validation (équilibre, séquence, chaînage), qui n'existe pas encore. Insérer
 * des écritures « à la main » ici produirait un registre non chaîné, donc faux.
 */

import { PrismaClient } from '@prisma/client'
import { JOURNAUX, PCG } from './data/pcg'
import { accountClass, accountNature, isLettrable, naturalSide } from '../lib/accounting/account'

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

  console.log('→ Exercices')
  for (const annee of [2024, 2025]) {
    await db.fiscalYear.upsert({
      where: { companyId_dateDebut: { companyId: company.id, dateDebut: new Date(Date.UTC(annee, 0, 1)) } },
      update: {},
      create: {
        companyId: company.id,
        libelle: `Exercice ${annee}`,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
        statut: annee === 2025 ? 'ouvert' : 'cloture',
        reportANouveauGenere: annee === 2024,
        clotureLe: annee === 2024 ? new Date(Date.UTC(2025, 3, 30)) : null,
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

  const comptes = await db.account.count({ where: { companyId: company.id } })
  console.log(`\n✓ ${company.nom} — ${comptes} comptes, ${JOURNAUX.length} journaux, 2 exercices.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.$disconnect()
  })
