// src/components/home/RenderWidget.tsx
import PromoCarouselClient from "./PromoCarouselClient";
import type { HomeWidget } from "@/lib/home-widgets";

// Legacy shape kept for backwards-compat
type LegacyWidget = {
  id: string;
  type: "HERO" | "BANNER" | "CARD" | "HTML" | "PROMO_CAROUSEL";
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_href?: string | null;
  bg_color?: string | null;
  text_color?: string | null;
  data?: any;
};

type Props = { widget: HomeWidget | LegacyWidget };

// Small helpers to normalize both shapes
function getKind(w: HomeWidget | LegacyWidget): string {
  return (w as any).kind ?? (w as any).type ?? "";
}
function getPayload(w: HomeWidget | LegacyWidget): any {
  return (w as any).payload ?? (w as any).data ?? {};
}
function getTitle(w: HomeWidget | LegacyWidget): string | null {
  return (w as any).title ?? null;
}
function getSubtitle(w: HomeWidget | LegacyWidget): string | null {
  return (w as any).subtitle ?? null;
}

export default function RenderWidget({ widget }: Props) {
  const kind = getKind(widget);
  const payload = getPayload(widget);
  const title = getTitle(widget);
  const subtitle = getSubtitle(widget);

  /* ---------------- PROMO CAROUSEL ---------------- */
  if (kind === "PROMO_CAROUSEL") {
    const items = payload.items ?? [];                // [{image_url, href, caption?}]
    const autoMs = Number(payload.autoMs ?? 4000);
    return (
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        {title && <h2 className="text-xl md:text-2xl font-semibold mb-3">{title}</h2>}
        {subtitle && <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>}
        <PromoCarouselClient items={items} autoMs={autoMs} />
      </section>
    );
  }

  /* ---------------- HERO ---------------- */
  if (kind === "HERO") {
    const bg = (widget as any).bg_color ?? payload.bg_color ?? "#0f172a";
    const imageUrl = (widget as any).image_url ?? payload.image_url ?? "";
    const ctas: Array<{ label: string; href: string }> = payload.ctas ?? [];
    const legacyCta = (widget as any).cta_href && (widget as any).cta_text
      ? [{ href: (widget as any).cta_href, label: (widget as any).cta_text }]
      : [];
    const allCtas = ctas.length ? ctas : legacyCta;

    return (
      <section className="relative overflow-hidden" style={{ backgroundColor: bg }}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            loading="lazy"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-16 text-white">
          {title && <h1 className="text-3xl md:text-5xl font-semibold">{title}</h1>}
          {subtitle && <p className="mt-3 text-white/90 text-sm md:text-base">{subtitle}</p>}
          {!!allCtas.length && (
            <div className="mt-6 flex gap-3">
              {allCtas.map((c, i) => (
                <a key={i} href={c.href} className="btn btn-primary">{c.label}</a>
              ))}
            </div>
          )}
          {(widget as any).body && (
            <p className="mt-4 text-white/80 text-sm max-w-2xl">{(widget as any).body}</p>
          )}
        </div>
      </section>
    );
  }

  /* ---------------- BANNER ---------------- */
  if (kind === "BANNER") {
    const bg = (widget as any).bg_color ?? payload.bg_color ?? "white";
    const fg = (widget as any).text_color ?? payload.text_color ?? "inherit";
    const imageUrl = (widget as any).image_url ?? payload.image_url ?? "";
    const ctaHref = (widget as any).cta_href ?? payload.cta_href ?? "";
    const ctaText = (widget as any).cta_text ?? payload.cta_text ?? "";

    return (
      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-6">
        <div className="rounded-2xl p-6 md:p-8 border card" style={{ backgroundColor: bg, color: fg }}>
          <div className="flex items-center gap-6">
            {imageUrl && <img src={imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl" loading="lazy" />}
            <div className="flex-1">
              {title && <div className="text-xl font-semibold">{title}</div>}
              {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            {ctaHref && ctaText && (
              <a href={ctaHref} className="btn btn-primary whitespace-nowrap">{ctaText}</a>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ---------------- CARD / FEATURED_PROJECTS ---------------- */
  if (kind === "CARD" || kind === "FEATURED_PROJECTS") {
    // Accept either payload.items or payload.cards
    const items: Array<{ title: string; subtitle?: string; image_url?: string; href?: string; tags?: string[] }> =
      payload.items ?? payload.cards ?? [];

    return (
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {title && <h2 className="text-xl md:text-2xl font-semibold mb-3">{title}</h2>}
        {subtitle && <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <a key={i} href={it.href || "#"} className="card overflow-hidden group">
              {it.image_url ? (
                <div className="aspect-[16/10] bg-muted">
                  <img src={it.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-muted grid place-items-center text-muted-foreground">No image</div>
              )}
              <div className="p-4">
                <div className="font-medium">{it.title}</div>
                {it.subtitle && <div className="text-xs text-muted-foreground mt-1">{it.subtitle}</div>}
                {!!(it as any).tags?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(it as any).tags.map((t: string) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  /* ---------------- HTML / CUSTOM_HTML ---------------- */
  if (kind === "HTML" || kind === "CUSTOM_HTML") {
    const html = (widget as any).body ?? payload.html ?? "";
    return (
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    );
  }

  return null;
}

