# Tagesschau Summary Architektur 📺🤖

Willkommen zum Tagesschau Automatisierungs-Projekt! Hier ist die Schritt-für-Schritt-Anleitung, wie du dieses Projekt zum Laufen bekommst.

## Schritt 1: Supabase Datenbank einrichten
1. Gehe zu [Supabase](https://supabase.com/) und öffne dein Projekt.
2. Gehe links im Menü auf den **SQL Editor** (das `{ }` Icon).
3. Klicke auf **New Query**.
4. Öffne die Datei `supabase-setup.sql` in diesem Ordner, kopiere den gesamten Inhalt und füge ihn in den Supabase SQL Editor ein.
5. Klicke auf **RUN** unten rechts. Die Tabelle ist nun fertig!

## Schritt 2: API-Keys besorgen & eintragen
Du musst die Datei `.env.example` in `.env.local` umbenennen (lokal) und diese Keys einfügen:

- **Gemini**: [aistudio.google.com](https://aistudio.google.com)
- **YouTube**: [console.cloud.google.com](https://console.cloud.google.com) (YouTube Data API v3 aktivieren!)
- **Supabase**: Im Dashboard unter Project Settings (Zahnrad) -> API. Du brauchst die URL, den `anon public` Key und den `service_role` Key.
- **Resend**: [resend.com](https://resend.com) -> API Keys.

## Schritt 3: GitHub Repository erstellen
1. Öffne ein Terminal im Ordner `tagesschau-summary`.
2. Führe diese Befehle aus:
   ```bash
   git init
   git add .
   git commit -m "Init project"
   ```
3. Gehe zu [GitHub](https://github.com/new) und erstelle ein neues, leeres Repository (z.B. `tagesschau-summary`).
4. Kopiere die Befehle unter *"…or push an existing repository from the command line"* und füge sie ins Terminal ein.

## Schritt 4: Deployment auf Vercel
1. Gehe zu [Vercel](https://vercel.com/) und klicke auf **Add New -> Project**.
2. Wähle dein neues GitHub-Repository aus und klicke auf **Import**.
3. **WICHTIG:** Klappe im Vercel-Setup den Bereich **Environment Variables** auf!
4. Füge dort nacheinander **ALLE** Variablen aus deiner `.env.local` Datei (bzw. `.env.example`) hinzu:
   - `GEMINI_API_KEY`
   - `YOUTUBE_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `NOTIFICATION_EMAIL`
   - *Tipp: Für `CRON_SECRET` kannst du dir dir einfach ein sicheres Wort ausdenken (z.B. `MeinGeheimesCronWort123`).*
5. Klicke auf **Deploy** und warte ca. 2 Minuten.

## Schritt 5: Cron-Job manuell testen
Standardmäßig läuft der Vercel Cron-Job täglich um 20:00, 21:00 und 22:00 Uhr UTC. (21:00, 22:00, 23:00 Uhr deutsche Zeit wg. Sommerzeit etc.)
Um zu testen ob alles klappt, rufe im Browser auf:
`https://DEINE-VERCEL-URL/api/cron/summarize`
*(Achtung: Wenn du das `CRON_SECRET` in Vercel gesetzt hast, geht das nicht mehr so einfach im Browser für Fremde – sehr gut!)*

Das war's! Die neueste Tagesschau wird jetzt jeden Abend automatisch analysiert. 🎉
