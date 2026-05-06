# Anthology

A visual poetry tool. Type a feeling, receive a poem. Discover the images it conjures.

---

## What it does

Anthology takes a word or phrase that describes how you feel and generates a short lyric poem using Claude. Once the poem is written, it searches Are.na for images that share the emotional texture of your input and arranges them as an interconnected graph of polaroids — a visual thread alongside the verse.

## Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4**
- **Anthropic SDK** — `claude-opus-4-7` with adaptive thinking, streamed
- **Are.na API** — v2 channel search + v3 channel contents
- **D3** — force-directed graph for the image layout
- **Google Fonts** — Playfair Display (UI) + Cormorant Garamond (poetry)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
ARENA_API_TOKEN=your_arena_personal_access_token
```

- **Anthropic key** — get one at [console.anthropic.com](https://console.anthropic.com)
- **Are.na token** — generate a personal access token at `are.na/settings/personal-access-tokens`

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use

1. Type a feeling between the quotation marks — a single word or a few words
2. Press **Enter**
3. Read the poem as it arrives
4. Scroll down to see the image graph drawn from Are.na channels that match your feeling

Editing the input after a poem is generated clears it and waits for a new Enter.

## Project structure

```
app/
  layout.tsx          # Fonts, metadata
  page.tsx            # Root — renders PoemGenerator
  globals.css         # Tailwind v4, theme tokens, animations
  api/
    poem/route.ts     # POST — streams poem from Claude
    images/route.ts   # GET  — fetches images from Are.na

components/
  PoemGenerator.tsx   # Main UI: input, poem display, orchestration
  ImageGraph.tsx      # D3 force-directed polaroid graph
```

## API notes

**Poem** — `POST /api/poem`  
Body: `{ feelings: string }`  
Returns a `text/plain` stream. The client reads it chunk by chunk and appends to the poem display.

**Images** — `GET /api/images?q={feelings}`  
Two-step Are.na fetch: searches v2 for channels matching the query, then fetches block contents via v3 and filters for image type. Returns up to 10 image objects `{ id, title, imageUrl }`.

The Are.na v3 search endpoint requires a premium subscription, so this app uses the v2 search (free) to find relevant channels and the v3 channel contents endpoint (free) to pull images from them.

## Deployment

Deploy to Vercel with the two environment variables set in the project settings. No additional configuration needed — the streaming API route and D3 graph both work on the Edge and Node runtimes respectively.
