import { NextRequest } from "next/server";

// v3 block shape (image blocks only)
interface V3ImageBlock {
  id: number;
  type: string;
  title: string | null;
  image: {
    src: string; // original
    small: { src: string };
    medium: { src: string };
    large: { src: string };
  };
}

// v2 channel from search results
interface V2Channel {
  id: number;
  slug: string;
  length: number;
  [key: string]: unknown; // "nsfw?" uses bracket access
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const token = process.env.ARENA_API_TOKEN;
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  // Step 1: v2 search → channel slugs (v3 search is premium-only)
  const searchRes = await fetch(
    `https://api.are.na/v2/search?q=${encodeURIComponent(q)}&per=10`,
    { headers }
  );
  if (!searchRes.ok) return Response.json({ images: [] });

  const searchData = await searchRes.json();
  const channels: V2Channel[] = (searchData.channels ?? [])
    .filter((c: V2Channel) => !c["nsfw?"] && c.length >= 5)
    .slice(0, 4);

  if (!channels.length) return Response.json({ images: [] });

  // Step 2: v3 channel contents in parallel (data is a flat array of blocks)
  const contentResults = await Promise.allSettled(
    channels.map(async (ch) => {
      const res = await fetch(
        `https://api.are.na/v3/channels/${ch.slug}/contents?per=50`,
        { headers }
      );
      if (!res.ok) return [] as V3ImageBlock[];
      const body = await res.json();
      // v3: { data: Block[], meta: {...} }
      return (body.data ?? []) as V3ImageBlock[];
    })
  );

  // Step 3: collect unique image blocks
  const seen = new Set<number>();
  const images: { id: number; title: string; imageUrl: string }[] = [];

  for (const result of contentResults) {
    if (result.status !== "fulfilled") continue;
    for (const block of result.value) {
      if (block.type !== "Image" || seen.has(block.id)) continue;
      const url =
        block.image?.medium?.src ??
        block.image?.small?.src ??
        block.image?.src;
      if (!url) continue;
      seen.add(block.id);
      images.push({ id: block.id, title: block.title ?? "", imageUrl: url });
      if (images.length >= 10) break;
    }
    if (images.length >= 10) break;
  }

  return Response.json({ images });
}
