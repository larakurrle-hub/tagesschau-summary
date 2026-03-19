import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ──────────────────────────────────────────────
// Next.js Einstellungen: Die Seite soll nicht 
// statisch zwischengespeichert werden, damit 
// neue Einträge sofort sichtbar sind.
// ──────────────────────────────────────────────
export const revalidate = 0

export default async function Home() {
  // Lade alle Zusammenfassungen aus der Datenbank (neueste zuerst)
  const { data: summaries, error } = await supabase
    .from('summaries')
    .select('id, title, published_at, thumbnail_url, summary')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Fehler beim Laden der Zusammenfassungen:', error.message)
    return (
      <div className="container">
        <h1>Ups, da ist was schiefgelaufen.</h1>
        <p>Die Datenbank konnte nicht erreicht werden.</p>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="page-header">
        <h1>Die Tagesschau – Zusammengefasst</h1>
        <p className="subtitle">
          Tägliche KI-Zusammenfassungen der 20-Uhr-Nachrichten. <br />
          Lies das Wichtigste in 2 Minuten.
        </p>
      </header>

      {summaries && summaries.length > 0 ? (
        <div className="grid">
          {summaries.map((item) => (
            <Link href={`/summary/${item.id}`} key={item.id} className="card">
              <div className="card-image-wrapper">
                <Image
                  src={item.thumbnail_url}
                  alt={item.title}
                  fill
                  className="card-image"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="card-content">
                <time className="card-date">
                  {new Date(item.published_at).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <h2 className="card-title">{item.title}</h2>
                <p className="card-excerpt">
                  {/* Zeige nur den Anfang der Zusammenfassung */}
                  {item.summary.split('\n')[0].replace('• ', '')} ...
                </p>
                <span className="read-more">Ganze Meldung lesen →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Noch keine Zusammenfassungen vorhanden</h2>
          <p>
            Sobald der Cron-Job das erste Video verarbeitet hat, 
            werden die Ergebnisse hier angezeigt.
          </p>
        </div>
      )}
    </div>
  )
}
