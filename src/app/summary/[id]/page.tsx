import { supabaseAdmin } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
  params: {
    id: string
  }
}

export const revalidate = 0

export default async function SummaryPage({
  params,
  searchParams,
}: Props & { searchParams: { lang?: string } }) {
  const lang = searchParams.lang === 'en' ? 'en' : 'de'
  // Eine einzelne Zusammenfassung laden
  const { data: summary, error } = await supabaseAdmin
    .from('summaries')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !summary) {
    if (error?.code === '22P02' || error?.code === 'PGRST116') {
      return notFound()
    }
    console.error('Fehler beim Laden:', error)
    return <div>Fehler beim Laden.</div>
  }

  // Datum formatieren
  const dateFormatted = new Date(summary.published_at).toLocaleDateString(
    'de-DE',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  )

  const youtubeUrl = `https://www.youtube.com/watch?v=${summary.video_id}`

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <Link href={`/${lang === 'en' ? '?lang=en' : ''}`} className="back-link">
        {lang === 'en' ? '← Back to overview' : '← Zurück zur Übersicht'}
      </Link>

      <article className="article">
        <header className="article-header">
          <time className="article-date">
            {new Date(summary.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1 className="article-title">{summary.title}</h1>
        </header>

        <div className="article-hero">
          <Image
            src={summary.thumbnail_url}
            alt={summary.title}
            width={1280}
            height={720}
            className="article-image"
          />
        </div>

        <section className="article-section">
          <h2>{lang === 'en' ? 'News Summary' : 'Nachrichten-Zusammenfassung'}</h2>
          <div className="summary-list">
            {(lang === 'en' && summary.summary_en ? summary.summary_en : summary.summary)
              .split('\n')
              .map((line: string, i: number) => {
              line = line.trim()
              if (!line) return null
              
              // Wenn die Zeile mit einem Bullet-Point anfängt, formatieren
              if (line.startsWith('•') || line.startsWith('-')) {
                const parts = line.substring(1).split(':')
                const topic = parts[0]?.trim()
                const text = parts.slice(1).join(':')?.trim() || ''

                if (topic && text) {
                  return (
                    <div key={i} className="summary-item">
                      <span className="summary-bullet"></span>
                      <div>
                        <strong>{topic}: </strong>
                        {text}
                      </div>
                    </div>
                  )
                }
              }
              // Normaler Absatz
              return <p key={i}>{line}</p>
            })}
          </div>
        </section>

        <section className="article-section highlight-box">
          <h2>🔎 Visuelle Beschreibung</h2>
          <p className="visual-description">{summary.visual_description}</p>
        </section>

        <div className="article-actions">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="youtube-button"
          >
            ▶ Original auf YouTube ansehen
          </a>
        </div>
      </article>
    </div>
  )
}
