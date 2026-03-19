import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const font = Outfit({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tagesschau Zusammenfassungen',
  description: 'Tägliche KI-Zusammenfassungen der 20-Uhr-Tagesschau',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={font.className}>
        <nav className="navbar">
          <div className="navbar-inner">
            <a href="/" className="navbar-brand">
              <span className="brand-icon">📺</span>
              <span className="brand-text">Tagesschau KI</span>
            </a>
            <span className="navbar-tagline">Tägliche Zusammenfassungen</span>
          </div>
        </nav>
        <main className="main-content">{children}</main>
        <footer className="footer">
          <p>Automatisch generiert mit Groq · Kein offizielles ARD-Produkt</p>
        </footer>
      </body>
    </html>
  )
}
