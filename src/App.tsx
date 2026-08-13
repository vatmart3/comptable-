import { Crosshair, CursorProvider } from './components/Crosshair'
import { Footer } from './components/Footer'
import { Head } from './components/Head'
import { Hero } from './components/Hero'
import { Ledger } from './components/Ledger'
import { Nav } from './components/Nav'
import { SectionCases } from './components/SectionCases'
import { SectionContact } from './components/SectionContact'
import { SectionCost } from './components/SectionCost'
import { SectionCraft } from './components/SectionCraft'
import { SectionExpert } from './components/SectionExpert'
import { SectionObjections } from './components/SectionObjections'
import { SectionPricing } from './components/SectionPricing'
import { SectionSim } from './components/SectionSim'
import { LedgerProvider } from './lib/ledger'
import { useSmoothScroll } from './lib/useSmoothScroll'

export default function App() {
  useSmoothScroll()

  return (
    <LedgerProvider>
      <CursorProvider>
        <Head />
        <Nav />
        <Ledger />
        <Crosshair />

        {/* pt : la barre de sommaire est fixe.
            pb : la barre du grand livre l'est aussi, sur mobile. */}
        <main className="pt-[3.25rem] pb-24 lg:pb-0">
          <Hero />
          <SectionCost />
          <SectionCraft />
          <SectionSim />
          <SectionExpert />
          <SectionCases />
          <SectionPricing />
          <SectionObjections />
          <SectionContact />
        </main>

        <Footer />
      </CursorProvider>
    </LedgerProvider>
  )
}
