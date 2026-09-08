import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/figtree'
import '@fontsource-variable/geist-mono'
import './globals.css'
import { PaletteCommandes } from '@/components/palette/PaletteCommandes'

export const metadata: Metadata = {
  title: 'SOLDE — la comptabilité qui se tient droite',
  description:
    'Progiciel de gestion comptable française : saisie en quatre secondes, registre inviolable, clôture sans peur.',
  applicationName: 'SOLDE',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5F1' },
    { media: '(prefers-color-scheme: dark)', color: '#141412' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PaletteCommandes />
      </body>
    </html>
  )
}
