import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client für das Frontend (öffentliche Daten)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin-Client für den Server (Schreiben in die Datenbank)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Summary = {
  id: string
  video_id: string
  title: string
  published_at: string
  summary: string
  visual_description: string
  processed_at: string
  thumbnail_url: string
}
