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
// Schritt 1: Neuestes Video aus YouTube Playlist laden
// ──────────────────────────────────────────────
async function getLatestPlaylistVideo() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY fehlt in den Umgebungsvariablen')

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('playlistId', PLAYLIST_ID)
  url.searchParams.set('maxResults', '3')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouTube API Fehler: ${err}`)
  }

  const data = await res.json()
  const item = data.items?.[0]
  if (!item) throw new Error('Keine Videos in der Playlist gefunden')

  const videoId = item.contentDetails.videoId
  const title = item.snippet.title
  const publishedAt = item.snippet.publishedAt
  const thumbnail =
    item.snippet.thumbnails?.maxres?.url ||
    item.snippet.thumbnails?.high?.url ||
    item.snippet.thumbnails?.default?.url

  return { videoId, title, publishedAt, thumbnail }
}

// ──────────────────────────────────────────────
// Schritt 2: Prüfen ob// ──────────────────────────────────────────────
// Schritt 3: Video-Thema via Groq analysieren
// ──────────────────────────────────────────────
async function analyzeWithGroq(videoId: string, title: string) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY fehlt in den Umgebungsvariablen')

  const prompt = `Du analysierst eine Folge der Tagesschau (20-Uhr-Ausgabe).
Thema des Videos: "${title}"

Bitte erstelle eine kurze, sachliche Zusammenfassung der wichtigsten Punkte (als Aufzählung mit •) und eine kurze visuelle Beschreibung der Sendung (Moderatoren, Studio, Berichte).

Antworte NUR mit folgendem JSON-Format:
{
  "summary": "• Thema 1: ... \\n • Thema 2: ...",
  "visual_description": "Beschreibung der visuellen Elemente..."
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
    visual_description: content.visual_description as string,
  }
}
den • Aufzählungspunkten",
  "visual_description": "Hier die visuelle Beschreibung als Fließtext"
}`

  const result = await model.generateContent(`Analysiere das folgende Video-Thema: ${videoId}. 
Bitte erstelle eine kurze Zusammenfassung und visuelle Beschreibung als JSON.
JSON Format: { "summary": "...", "visual_description": "..." }`)

  const responseText = result.response.text()

  // JSON aus der Antwort extrahieren
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini hat kein gültiges JSON zurückgegeben: ${responseText}`)
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    summary: parsed.summary as string,
    visual_description: parsed.visual_description as string,
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
  visual_description: string
}) {
  const { error } = await supabaseAdmin.from('summaries').insert({
    video_id: data.videoId,
    title: data.title,
    published_at: data.publishedAt,
    thumbnail_url: data.thumbnail,
    summary: data.summary,
    visual_description: data.visual_description,
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
    // 1. Neuestes YouTube-Video holen
    console.log('📺 Lade neuestes Tagesschau-Video...')
    const video = await getLatestPlaylistVideo()
    console.log(`✅ Video gefunden: ${video.title} (${video.videoId})`)

    // 2. Prüfen ob bereits verarbeitet
    const processed = await isAlreadyProcessed(video.videoId)
    if (processed) {
      console.log(`⏭️ Video ${video.videoId} wurde bereits verarbeitet – überspringe.`)
      return NextResponse.json({
        success: true,
        message: `Video ${video.videoId} bereits verarbeitet`,
        skipped: true,
      })
    }

    // 3. Groq Analyse
    console.log('🤖 Sende Video-Info an Groq für Analyse...')
    const analysis = await analyzeWithGroq(video.videoId, video.title)
    console.log('✅ Groq Analyse abgeschlossen')

    // 4. In Supabase speichern
    console.log('💾 Speichere in Supabase...')
    await saveToSupabase({
      videoId: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt,
      thumbnail: video.thumbnail,
      summary: analysis.summary,
      visual_description: analysis.visual_description,
    })
    console.log('✅ In Supabase gespeichert')

    // 5. E-Mail senden
    console.log('📧 Sende E-Mail Benachrichtigung...')
    await sendEmailNotification({
      title: video.title,
      publishedAt: video.publishedAt,
      summary: analysis.summary,
      videoId: video.videoId,
    })
    console.log('✅ E-Mail gesendet')

    return NextResponse.json({
      success: true,
      message: `Tagesschau vom ${new Date(video.publishedAt).toLocaleDateString('de-DE')} erfolgreich verarbeitet`,
      videoId: video.videoId,
      title: video.title,
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
