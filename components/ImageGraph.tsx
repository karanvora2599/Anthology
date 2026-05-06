"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// ── Public types ─────────────────────────────────────────────────────────────
export type ArenaImage = { id: number; title: string; imageUrl: string };

// ── Caption generation ───────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const YEARS = [1973,1979,1984,1988,1992,1995,1997,2000,2002,2005,2007,2010,2013,2016];
const WORDS = [
  "tender","wistful","aching","still","distant","golden","quiet","longing",
  "hushed","soft","yearning","hollow","fading","warm","searching","melancholy",
  "gentle","lost","luminous","heavy","drifting","pale","infinite","fleeting",
  "remembered","open","waiting","borrowed","silver","muted",
];

function mkCaption(id: number) {
  return {
    word: WORDS[(id * 11 + 7) % WORDS.length],
    date: `${MONTHS[(id * 7 + 3) % MONTHS.length]} ${YEARS[(id * 13 + 5) % YEARS.length]}`,
  };
}

// ── D3 types ─────────────────────────────────────────────────────────────────
type GNode = ArenaImage &
  d3.SimulationNodeDatum & {
    captionWord: string;
    captionDate: string;
  };

type RawLink = { source: number; target: number; eid: string };
type SimLink = d3.SimulationLinkDatum<GNode> & { eid: string };

function nodeTilt(id: number) {
  return (((id * 137 + 17) % 13) - 6) * 1.2;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageGraph({
  images,
  feelings,
}: {
  images: ArenaImage[];
  feelings: string;
}) {
  // D3 mutable refs (not React state)
  const nodesRef    = useRef<GNode[]>([]);
  const rawLinksRef = useRef<RawLink[]>([]);
  const simRef      = useRef<d3.Simulation<GNode, SimLink> | null>(null);
  const dimsRef     = useRef({ w: 640 });
  const hRef        = useRef(540);

  // React render state
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH]   = useState(540);
  const [nodesList, setNodesList]     = useState<GNode[]>([]);
  const [positions, setPositions]     = useState<Map<number, { x: number; y: number }>>(new Map());
  const [edgeLines, setEdgeLines]     = useState<
    { x1: number; y1: number; x2: number; y2: number; eid: string }[]
  >([]);
  const [expandingIds, setExpandingIds] = useState<Set<number>>(new Set());
  const [expandedIds,  setExpandedIds]  = useState<Set<number>>(new Set());
  const [freshIds,     setFreshIds]     = useState<Set<number>>(new Set());

  // ── Resize observer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      dimsRef.current = { w };
      const sim = simRef.current;
      if (sim) {
        (sim.force("center") as d3.ForceCenter<GNode>)?.x(w / 2)?.y(hRef.current / 2);
        sim.alpha(0.15).restart();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Init when images prop changes ────────────────────────────────────────
  useEffect(() => {
    if (!images.length) return;
    initSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  function initSim() {
    simRef.current?.stop();
    setExpandingIds(new Set());
    setExpandedIds(new Set());
    setFreshIds(new Set());

    const w = dimsRef.current.w || 640;
    const h = Math.max(580, Math.round(w * 0.7));
    hRef.current = h;
    setContainerH(h);

    const count = images.length;
    const r = Math.min(w, h) * 0.22;

    const nodes: GNode[] = images.map((img, i) => {
      const cap = mkCaption(img.id);
      return {
        ...img,
        captionWord: cap.word,
        captionDate: cap.date,
        x: w / 2 + Math.cos((2 * Math.PI * i) / count) * r,
        y: h / 2 + Math.sin((2 * Math.PI * i) / count) * r,
      };
    });

    // Ring edges + one diagonal for a non-star start
    const links: RawLink[] = images.map((img, i) => ({
      source: img.id,
      target: images[(i + 1) % count].id,
      eid: `${img.id}-${images[(i + 1) % count].id}`,
    }));
    if (count >= 4) {
      links.push({
        source: images[0].id,
        target: images[2].id,
        eid: `${images[0].id}-${images[2].id}`,
      });
    }

    nodesRef.current    = nodes;
    rawLinksRef.current = links;
    setNodesList([...nodes]);
    launchSim(w, h);
  }

  function launchSim(w: number, h: number) {
    const lf = d3
      .forceLink<GNode, SimLink>(rawLinksRef.current.map((l) => ({ ...l })) as SimLink[])
      .id((n) => n.id)
      .distance(218)
      .strength(0.28);

    const sim = d3
      .forceSimulation<GNode>(nodesRef.current)
      .force("link", lf)
      .force("charge", d3.forceManyBody<GNode>().strength(-500))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.06))
      .force("collide", d3.forceCollide<GNode>().radius(90).strength(0.85))
      .alphaDecay(0.016)
      .on("tick", () => {
        const W = dimsRef.current.w || 640;
        const H = hRef.current;
        // Asymmetric Y padding: polaroid extends 85px above pos.y, ~55px below
        const PAD_X  = 80;
        const PAD_YT = 100; // top — keeps the polaroid top edge inside
        const PAD_YB = 70;  // bottom
        nodesRef.current.forEach((n) => {
          n.x = Math.max(PAD_X,  Math.min(W - PAD_X,  n.x ?? W / 2));
          n.y = Math.max(PAD_YT, Math.min(H - PAD_YB, n.y ?? H / 2));
        });
        setPositions(new Map(nodesRef.current.map((n) => [n.id, { x: n.x!, y: n.y! }])));
        const mutLinks = (simRef.current!.force("link") as d3.ForceLink<GNode, SimLink>).links();
        setEdgeLines(
          mutLinks.map((l) => ({
            x1: (l.source as GNode).x ?? 0,
            y1: (l.source as GNode).y ?? 0,
            x2: (l.target as GNode).x ?? 0,
            y2: (l.target as GNode).y ?? 0,
            eid: (l as unknown as RawLink).eid,
          }))
        );
      });

    simRef.current = sim;
  }

  // ── Expand a node ────────────────────────────────────────────────────────
  const handleExpand = useCallback(
    async (nodeId: number) => {
      if (expandingIds.has(nodeId) || expandedIds.has(nodeId)) return;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      setExpandingIds((prev) => new Set([...prev, nodeId]));

      // Search Are.na by the node's caption word — this is the "subtopic"
      const word = node.captionWord;
      const excludeParam = nodesRef.current.map((n) => n.id).join(",");

      try {
        const res = await fetch(
          `/api/images?q=${encodeURIComponent(word)}&per=4&exclude=${excludeParam}`
        );
        const data = await res.json();
        const newImgs: ArenaImage[] = data.images ?? [];

        // Mark as expanded regardless of results
        setExpandingIds((prev) => { const s = new Set(prev); s.delete(nodeId); return s; });
        setExpandedIds((prev) => new Set([...prev, nodeId]));

        if (!newImgs.length) return;

        // Spawn near parent
        const jitter = () => (Math.random() - 0.5) * 72;
        const px = node.x ?? dimsRef.current.w / 2;
        const py = node.y ?? hRef.current / 2;

        const newNodes: GNode[] = newImgs.map((img) => {
          const cap = mkCaption(img.id);
          return { ...img, captionWord: cap.word, captionDate: cap.date, x: px + jitter(), y: py + jitter() };
        });

        // Edges: parent → each child, chain children together
        const newLinks: RawLink[] = [];
        newNodes.forEach((n, i) => {
          newLinks.push({ source: nodeId, target: n.id, eid: `${nodeId}-${n.id}` });
          if (i > 0)
            newLinks.push({ source: newNodes[i - 1].id, target: n.id, eid: `${newNodes[i - 1].id}-${n.id}` });
        });

        nodesRef.current.push(...newNodes);
        rawLinksRef.current.push(...newLinks);

        // Grow container
        const newH = Math.max(hRef.current, 580 + Math.max(0, nodesRef.current.length - 4) * 28);
        hRef.current = newH;
        setContainerH(newH);

        // Hot-patch simulation
        const sim = simRef.current!;
        sim.nodes(nodesRef.current);
        (sim.force("link") as d3.ForceLink<GNode, SimLink>).links(
          rawLinksRef.current.map((l) => ({ ...l })) as SimLink[]
        );
        sim.alpha(0.5).restart();

        // Fade-in new polaroids
        const ids = new Set(newNodes.map((n) => n.id));
        setFreshIds(ids);
        setTimeout(() => setFreshIds(new Set()), 900);

        setNodesList([...nodesRef.current]);
      } catch {
        setExpandingIds((prev) => { const s = new Set(prev); s.delete(nodeId); return s; });
      }
    },
    [expandingIds, expandedIds]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <p
        className="text-center text-xs tracking-widest uppercase"
        style={{ fontFamily: "var(--font-playfair)", color: "#7A6B5A", letterSpacing: "0.18em" }}
      >
        A visual thread · {feelings}
      </p>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: containerH, transition: "height 0.7s ease" }}
      >
        {/* Edge lines */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 0, pointerEvents: "none" }}
        >
          {edgeLines.map((l) => (
            <line
              key={l.eid}
              x1={l.x1} y1={l.y1}
              x2={l.x2} y2={l.y2}
              stroke="#C2B8A8"
              strokeWidth={1.2}
              strokeOpacity={0.5}
            />
          ))}
        </svg>

        {/* Polaroid nodes */}
        {nodesList.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const t          = nodeTilt(node.id);
          const isExpanding = expandingIds.has(node.id);
          const isExpanded  = expandedIds.has(node.id);
          const isFresh     = freshIds.has(node.id);

          return (
            <div
              key={node.id}
              className={isFresh ? "animate-fade-in" : ""}
              style={{
                position: "absolute",
                left: pos.x - 65,
                top: pos.y - 85,
                width: 130,
                transform: `rotate(${t}deg)`,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: "#FDFAF4",
                  padding: "8px 8px 34px 8px",
                  borderRadius: "2px",
                  boxShadow: "0 4px 20px rgba(28,26,23,0.15), 0 1px 4px rgba(28,26,23,0.07)",
                }}
              >
                {/* Image with expand button */}
                <div style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={node.imageUrl}
                    alt=""
                    style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }}
                  />

                  {!isExpanded && (
                    <button
                      onClick={() => handleExpand(node.id)}
                      aria-label={`Explore ${node.captionWord}`}
                      style={{
                        position: "absolute",
                        bottom: 5,
                        right: 5,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "rgba(253,250,244,0.9)",
                        border: "none",
                        cursor: isExpanding ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        color: "#1C1A17",
                        lineHeight: 1,
                        padding: 0,
                        opacity: isExpanding ? 0.5 : 0.8,
                      }}
                    >
                      {isExpanding
                        ? <span className="animate-pulse" style={{ letterSpacing: 0 }}>·</span>
                        : "+"}
                    </button>
                  )}
                </div>

                {/* Poetic caption */}
                <div style={{ marginTop: 6, textAlign: "center" }}>
                  <p
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "0.7rem",
                      fontStyle: "italic",
                      color: "#5C4A38",
                      lineHeight: 1.25,
                      margin: 0,
                    }}
                  >
                    {node.captionWord}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "0.6rem",
                      color: "#7A6B5A",
                      lineHeight: 1.2,
                      margin: 0,
                      marginTop: 1,
                      opacity: 0.7,
                    }}
                  >
                    {node.captionDate}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <p
        className="text-center"
        style={{
          fontFamily: "var(--font-playfair)",
          fontSize: "0.6rem",
          color: "#7A6B5A",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: 0.45,
        }}
      >
        tap + to follow a thread
      </p>
    </div>
  );
}
