"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Item = { image_url?: string; title?: string; caption?: string; href?: string };
export default function PromoCarouselClient({
  items,
  autoMs = 4000,
}: {
  items: Item[];
  autoMs?: number;
}) {
  const slides = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [i, setI] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    timer.current = window.setInterval(() => {
      setI((n) => (n + 1) % slides.length);
    }, Math.max(2500, autoMs));
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [slides.length, autoMs]);

  const go = (dir: -1 | 1) => {
    if (!slides.length) return;
    setI((n) => (n + dir + slides.length) % slides.length);
  };

  if (!slides.length) {
    return <div className="aspect-[16/7] rounded-2xl bg-muted grid place-items-center">No promo items</div>;
  }

  const cur = slides[i];

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    cur.href ? (
      <a href={cur.href} className="block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--primary)] rounded-2xl">
        {children}
      </a>
    ) : (
      <div>{children}</div>
    );

  return (
    <div className="relative">
      <Wrapper>
        <div className="aspect-[16/7] overflow-hidden rounded-2xl border">
          {cur.image_url ? (
            <img src={cur.image_url} alt={cur.title || ""} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted grid place-items-center">No image</div>
          )}
        </div>
      </Wrapper>

      {/* text overlay (optional) */}
      {(cur.title || cur.caption) && (
        <div className="absolute left-4 right-4 bottom-4 md:left-6 md:right-6 md:bottom-6">
          <div className="rounded-xl bg-black/55 text-white px-4 py-3 backdrop-blur">
            {cur.title && <div className="font-semibold">{cur.title}</div>}
            {cur.caption && <div className="text-sm opacity-90">{cur.caption}</div>}
          </div>
        </div>
      )}

      {/* controls */}
      {slides.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white px-3 py-2 shadow"
            onClick={() => go(-1)}
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white px-3 py-2 shadow"
            onClick={() => go(1)}
            aria-label="Next slide"
          >
            ›
          </button>

          <div className="absolute left-0 right-0 bottom-2 flex items-center justify-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-2 w-2 rounded-full ${idx === i ? "bg-white" : "bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
