"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import ImageGraph, { type ArenaImage } from "./ImageGraph";

type GenState = "idle" | "generating" | "done";
type ImgState = "idle" | "loading" | "ready";

export default function PoemGenerator() {
  const inputRef = useRef<HTMLSpanElement>(null);
  const poemRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState("");
  const [poem, setPoem] = useState("");
  const [genState, setGenState] = useState<GenState>("idle");
  const [imgState, setImgState] = useState<ImgState>("idle");
  const [images, setImages] = useState<ArenaImage[]>([]);
  const [copied, setCopied] = useState(false);

  function handleInput(e: React.FormEvent<HTMLSpanElement>) {
    const text = e.currentTarget.textContent ?? "";
    setInputValue(text);
    // Clear previous results when user edits
    if (genState === "done") {
      setPoem("");
      setGenState("idle");
      setImages([]);
      setImgState("idle");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  }

  async function generate() {
    const feelings = inputRef.current?.textContent?.trim() ?? "";
    if (!feelings || genState === "generating") return;

    setPoem("");
    setImages([]);
    setImgState("idle");
    setGenState("generating");
    setCopied(false);

    try {
      const res = await fetch("/api/poem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feelings }),
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setPoem((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setGenState("done");
      fetchImages(feelings);

      setTimeout(
        () => poemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80
      );
    } catch {
      setGenState("idle");
    }
  }

  async function fetchImages(feelings: string) {
    setImgState("loading");
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(feelings)}`);
      const data = await res.json();
      const imgs: ArenaImage[] = data.images ?? [];
      setImages(imgs);
      setImgState(imgs.length >= 3 ? "ready" : "idle");
      if (imgs.length >= 3) {
        setTimeout(
          () => graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          300
        );
      }
    } catch {
      setImgState("idle");
    }
  }

  async function copyPoem() {
    await navigator.clipboard.writeText(poem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isGenerating = genState === "generating";

  return (
    <main className="flex flex-col">
      {/* ── Hero: logo + quote input ── */}
      <section className="flex flex-col items-center justify-center min-h-screen px-8 gap-10">
        <Image
          src="/logo.png"
          alt="Anthology"
          width={300}
          height={98}
          priority
          style={{ opacity: 0.9 }}
        />

        {/* " input " */}
        <div className="flex items-baseline gap-3">
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "3.2rem",
              fontStyle: "italic",
              color: "#1C1A17",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            &ldquo;
          </span>

          <span
            ref={inputRef}
            role="textbox"
            aria-label="Describe your feeling"
            contentEditable={!isGenerating}
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder="............"
            className="quote-input"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "3.2rem",
              fontStyle: "italic",
              color: "#1C1A17",
              lineHeight: 1,
              outline: "none",
              borderBottom: "1.5px dotted #1C1A17",
              minWidth: "7rem",
              display: "inline-block",
              cursor: isGenerating ? "default" : "text",
            }}
          />

          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "3.2rem",
              fontStyle: "italic",
              color: "#1C1A17",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            &rdquo;
          </span>
        </div>

        {/* Contextual hint */}
        <p
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "0.65rem",
            color: "#7A6B5A",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: "-1.5rem",
            opacity: isGenerating ? 1 : inputValue ? 0.8 : 0.5,
            transition: "opacity 0.3s",
          }}
        >
          {isGenerating ? "writing…" : "press Enter"}
        </p>
      </section>

      {/* ── Poem ── */}
      {(isGenerating || genState === "done") && poem && (
        <section
          ref={poemRef}
          className="flex flex-col items-center px-8 pb-32 animate-fade-in"
        >
          <div style={{ maxWidth: "38rem", width: "100%", textAlign: "center" }}>
            <pre
              className="whitespace-pre-wrap"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "1.4rem",
                fontStyle: "italic",
                color: "#1C1A17",
                lineHeight: 1.9,
              }}
            >
              {poem}
              {isGenerating && (
                <span
                  className="animate-blink inline-block w-[2px] h-[1.1em] ml-[2px] align-middle"
                  style={{ background: "#B8945A" }}
                />
              )}
            </pre>

            {genState === "done" && (
              <button
                onClick={copyPoem}
                style={{
                  marginTop: "2.5rem",
                  fontFamily: "var(--font-playfair)",
                  fontSize: "0.62rem",
                  color: copied ? "#B8945A" : "#7A6B5A",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "block",
                  marginInline: "auto",
                }}
              >
                {copied ? "Copied" : "Copy poem"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Image graph ── */}
      {(imgState === "loading" || imgState === "ready") && (
        <section ref={graphRef} className="px-8 pb-32">
          {imgState === "loading" && (
            <p
              className="text-center animate-pulse"
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "0.62rem",
                color: "#7A6B5A",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Gathering images…
            </p>
          )}
          {imgState === "ready" && (
            <div style={{ maxWidth: "56rem", marginInline: "auto" }}>
              <ImageGraph
                images={images}
                feelings={inputRef.current?.textContent?.trim() ?? inputValue}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
