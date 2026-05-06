import { NextRequest } from "next/server";

interface V3ImageBlock {
  id: number;
  type: string;
  title: string | null;
  image: {
    src: string;
    small: { src: string };
    medium: { src: string };
    large: { src: string };
  };
}

interface V2Channel {
  id: number;
  slug: string;
  length: number;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const per = Math.min(parseInt(url.searchParams.get("per") ?? "4"), 12);
  const excludeSet = new Set(
    (url.searchParams.get("exclude") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number)
  );

  const token = process.env.ARENA_API_TOKEN;
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  // Step 1: v2 search for channels
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

  // Step 2: v3 channel contents in parallel
  const contentResults = await Promise.allSettled(
    channels.map(async (ch) => {
      const res = await fetch(
        `https://api.are.na/v3/channels/${ch.slug}/contents?per=50`,
        { headers }
      );
      if (!res.ok) return [] as V3ImageBlock[];
      const body = await res.json();
      return (body.data ?? []) as V3ImageBlock[];
    })
  );

  // Step 3: collect unique non-excluded image blocks
  const seen = new Set<number>();
  const images: { id: number; title: string; imageUrl: string }[] = [];

  for (const result of contentResults) {
    if (result.status !== "fulfilled") continue;
    for (const block of result.value) {
      if (block.type !== "Image") continue;
      if (seen.has(block.id) || excludeSet.has(block.id)) continue;
      const url =
        block.image?.medium?.src ??
        block.image?.small?.src ??
        block.image?.src;
      if (!url) continue;
      seen.add(block.id);
      images.push({ id: block.id, title: block.title ?? "", imageUrl: url });
      if (images.length >= per) break;
    }
    if (images.length >= per) break;
  }

  return Response.json({ images });
}
