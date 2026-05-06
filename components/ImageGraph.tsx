"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type ArenaImage = {
  id: number;
  title: string;
  imageUrl: string;
};

type SimNode = ArenaImage & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode>;

/** Builds a small-world mesh: ring + skip-1 chords + diameter chords. */
function buildEdges(n: number): { source: number; target: number }[] {
  if (n < 2) return [];
  const seen = new Set<string>();
  const edges: { source: number; target: number }[] = [];

  const add = (a: number, b: number) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ source: a, target: b });
    }
  };

  for (let i = 0; i < n; i++) add(i, (i + 1) % n);
  if (n >= 4) for (let i = 0; i < n; i++) add(i, (i + 2) % n);
  if (n >= 6) for (let i = 0; i < Math.ceil(n / 2); i++) add(i, (i + Math.floor(n / 2)) % n);

  return edges;
}

/** Stable pseudo-random tilt per node id — avoids per-render randomness. */
function getTilt(id: number) {
  return (((id * 137 + 17) % 13) - 6) * 1.2;
}

type EdgeLine = { x1: number; y1: number; x2: number; y2: number };
type NodePos = { id: number; x: number; y: number };

export default function ImageGraph({
  images,
  feelings,
}: {
  images: ArenaImage[];
  feelings: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  const [dims, setDims] = useState({ w: 640, h: 480 });
  const [nodePositions, setNodePositions] = useState<NodePos[]>([]);
  const [edgeLines, setEdgeLines] = useState<EdgeLine[]>([]);

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      setDims({ w, h: Math.max(420, Math.round(w * 0.68)) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Run simulation
  useEffect(() => {
    if (!images.length || !dims.w) return;

    simRef.current?.stop();

    const { w, h } = dims;
    const count = images.length;
    const radius = Math.min(w, h) * 0.3;

    const nodes: SimNode[] = images.map((img, i) => ({
      ...img,
      x: w / 2 + Math.cos((2 * Math.PI * i) / count) * radius,
      y: h / 2 + Math.sin((2 * Math.PI * i) / count) * radius,
    }));

    const edgeDefs = buildEdges(count);
    // D3 mutates source/target from numbers → node refs after initialize
    const links: SimLink[] = edgeDefs.map((e) => ({
      source: e.source as unknown as SimNode,
      target: e.target as unknown as SimNode,
    }));

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((_, i) => i)
          .distance(215)
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-520))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.08))
      .force("collide", d3.forceCollide<SimNode>().radius(88).strength(0.9))
      .alphaDecay(0.016)
      .on("tick", () => {
        const PAD_X = 72;
        const PAD_Y = 88;
        nodes.forEach((n) => {
          n.x = Math.max(PAD_X, Math.min(w - PAD_X, n.x ?? w / 2));
          n.y = Math.max(PAD_Y, Math.min(h - PAD_Y, n.y ?? h / 2));
        });

        setNodePositions(nodes.map((n) => ({ id: n.id, x: n.x!, y: n.y! })));
        setEdgeLines(
          links.map((l) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            return { x1: s.x ?? 0, y1: s.y ?? 0, x2: t.x ?? 0, y2: t.y ?? 0 };
          })
        );
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [images, dims]);

  const posMap = new Map(nodePositions.map((p) => [p.id, p]));

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">
      <p
        className="text-center text-xs tracking-widest uppercase"
        style={{ fontFamily: "var(--font-playfair)", color: "#7A6B5A", letterSpacing: "0.18em" }}
      >
        A visual thread · {feelings}
      </p>

      <div ref={containerRef} className="relative w-full" style={{ height: dims.h }}>
        {/* Edge layer */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 0, pointerEvents: "none" }}
        >
          {edgeLines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#C2B8A8"
              strokeWidth={1.2}
              strokeOpacity={0.55}
            />
          ))}
        </svg>

        {/* Polaroid nodes */}
        {images.map((img) => {
          const pos = posMap.get(img.id);
          if (!pos) return null;
          const tilt = getTilt(img.id);

          return (
            <div
              key={img.id}
              className="absolute"
              style={{
                left: pos.x - 65,
                top: pos.y - 80,
                width: 130,
                transform: `rotate(${tilt}deg)`,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: "#FDFAF4",
                  padding: "8px 8px 28px 8px",
                  borderRadius: "2px",
                  boxShadow:
                    "0 4px 18px rgba(28,26,23,0.16), 0 1px 4px rgba(28,26,23,0.08)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.title || "image"}
                  style={{
                    width: "100%",
                    height: 96,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <p
                  style={{
                    marginTop: 5,
                    textAlign: "center",
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "0.68rem",
                    fontStyle: "italic",
                    color: "#7A6B5A",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "0.9rem",
                  }}
                >
                  {img.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
