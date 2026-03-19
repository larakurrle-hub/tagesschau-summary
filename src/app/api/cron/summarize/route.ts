import { NextRequest, NextResponse } from 'next/server'
// import { GoogleGenerativeAI } from '@google/generative-ai' // Nicht mehr benötigt
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// Konfiguration
// ──────────────────────────────────────────────
const PLAYLIST_ID = 'PL4A2F331EE86DCC22' // Tagesschau 20:00 Uhr

// ──────────────────────────────────────────────
// Schritt 1: Die letzten 5 Videos aus YouTube Playlist laden
// ──────────────────────────────────────────────
async function getRecentPlaylistVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY fehlt in den Umgebungsvariablen')

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('playlistId', PLAYLIST_ID)
  url.searchParams.set('maxResults', '5') // Letzte 5 Videos
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouTube API Fehler: ${err}`)
  }

  const data = await res.json()
  if (!data.items?.length) throw new Error('Keine Videos in der Playlist gefunden')

  return data.items.map((item: any) => ({
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    thumbnail:
      item.snippet.thumbnails?.maxres?.url ||
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.default?.url,
  }))
}

// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Schritt 2: Prüfen ob Video bereits verarbeitet wurde
// ──────────────────────────────────────────────
async function isAlreadyProcessed(videoId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('summaries')
    .select('id')
    .eq('video_id', videoId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "kein Ergebnis" – das ist normal
    console.error('Supabase Fehler beim Prüfen:', error)
  }

  return !!data
}

// ──────────────────────────────────────────────
// Schritt 3: Video-Thema via Groq analysieren
// ──────────────────────────────────────────────
async function analyzeWithGroq(videoId: string, title: string) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY fehlt in den Umgebungsvariablen')

  const prompt = `Du analysierst eine Folge der Tagesschau (20-Uhr-Ausgabe).
Thema des Videos: "${title}"

Bitte erstelle:
1. Eine kurze, sachliche Zusammenfassung der wichtigsten Punkte auf DEUTSCH (als Aufzählung mit •).
2. Eine kurze visuelle Beschreibung der Sendung auf DEUTSCH.
3. Eine kurze, sachliche Zusammenfassung der wichtigsten Punkte auf ENGLISCH (summary_en).
4. Eine kurze visuelle Beschreibung der Sendung auf ENGLISCH (visual_description_en).

Antworte NUR mit folgendem JSON-Format:
{
  "summary": "• Thema 1: ... \\n • Thema 2: ...",
  "summary_en": "• Topic 1: ... \\n • Topic 2: ...",
  "visual_description": "Beschreibung auf Deutsch...",
  "visual_description_en": "Description in English..."
}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq API Fehler: ${err}`)
  }

  const data = await response.json()
  const content = JSON.parse(data.choices[0].message.content)
  
  return {
    summary: content.summary as string,
    summary_en: content.summary_en as string,
    visual_description: content.visual_description as string,
    visual_description_en: content.visual_description_en as string,
  }
}

// ──────────────────────────────────────────────
// Schritt 4: Ergebnisse in Supabase speichern
// ──────────────────────────────────────────────
async function saveToSupabase(data: {
  videoId: string
  title: string
  publishedAt: string
  thumbnail: string
  summary: string
  summary_en: string
  visual_description: string
  visual_description_en: string
}) {
  const { error } = await supabaseAdmin.from('summaries').insert({
    video_id: data.videoId,
    title: data.title,
    published_at: data.publishedAt,
    thumbnail_url: data.thumbnail,
    summary: data.summary,
    summary_en: data.summary_en,
    visual_description: data.visual_description,
    visual_description_en: data.visual_description_en,
    processed_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Supabase Speicherfehler: ${error.message}`)
}

// ──────────────────────────────────────────────
// Schritt 5: E-Mail via Resend senden
// ──────────────────────────────────────────────
async function sendEmailNotification(data: {
  title: string
  publishedAt: string
  summary: string
  videoId: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const dateFormatted = new Date(data.publishedAt).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const { error } = await resend.emails.send({
    from: 'Tagesschau Summary <onboarding@resend.dev>',
    to: process.env.NOTIFICATION_EMAIL!,
    subject: `📺 Tagesschau Zusammenfassung – ${dateFormatted}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #003366; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📺 Tagesschau Zusammenfassung</h1>
          <p style="color: #aac4e0; margin: 8px 0 0;">${dateFormatted}</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #003366; font-size: 18px;">${data.title}</h2>
          
          <div style="background: white; padding: 16px; border-left: 4px solid #003366; border-radius: 4px; margin: 16px 0;">
            ${data.summary
              .split('\n')
              .filter((line) => line.trim())
              .map((line) => `<p style="margin: 8px 0;">${line}</p>`)
              .join('')}
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://www.youtube.com/watch?v=${data.videoId}" 
               style="background: #cc0000; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: bold;">
              ▶ Video auf YouTube ansehen
            </a>
          </div>
        </div>
      </div>
    `,
  })

  if (error) {
    console.error('Resend E-Mail Fehler:', error)
    // E-Mail-Fehler ist nicht kritisch – wir stoppen den Prozess nicht deswegen
  }
}

// ──────────────────────────────────────────────
// Haupt-Handler: GET /api/cron/summarize
// ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Sicherheitscheck: Nur autorisierte Aufrufe erlauben
  // (Vercel Cron sendet automatisch den Authorization Header)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // In der Entwicklung (kein Secret gesetzt) erlauben wir alle Anfragen
    console.log('⚠️ Kein gültiger Auth-Header – wird nur in Produktion mit CRON_SECRET erzwungen')
  }

  console.log('🔄 Cron-Job gestartet:', new Date().toISOString())

  try {
    // 1. Letzte YouTube-Videos holen (Backfill)
    console.log('📺 Lade die letzten Tagesschau-Videos...')
    const videos = await getRecentPlaylistVideos()
    console.log(`✅ ${videos.length} Videos in Playlist gefunden.`)

    let processedCount = 0
    let skippedCount = 0

    // Jedes Video prüfen und ggf. verarbeiten
    for (const video of videos) {
      const processed = await isAlreadyProcessed(video.videoId)
      if (processed) {
        skippedCount++
        continue
      }

      console.log(`🤖 Verarbeite Video: ${video.title} (${video.videoId})...`)
      
      // Analyse
      const analysis = await analyzeWithGroq(video.videoId, video.title)
      
      // Speichern
      await saveToSupabase({
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
        thumbnail: video.thumbnail,
        summary: analysis.summary,
        summary_en: analysis.summary_en,
        visual_description: analysis.visual_description,
        visual_description_en: analysis.visual_description_en,
      })

      // E-Mail senden (nur für das allerneueste Video in der Liste, um Spam zu vermeiden)
      if (processedCount === 0 && skippedCount === 0) {
        console.log('📧 Sende E-Mail Benachrichtigung...')
        await sendEmailNotification({
          title: video.title,
          publishedAt: video.publishedAt,
          summary: analysis.summary,
          videoId: video.videoId,
        })
      }

      processedCount++
    }

    return NextResponse.json({
      success: true,
      message: `${processedCount} Videos erfolgreich verarbeitet, ${skippedCount} übersprungen.`,
      processed: processedCount,
      skipped: skippedCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('❌ Cron-Job Fehler:', message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
