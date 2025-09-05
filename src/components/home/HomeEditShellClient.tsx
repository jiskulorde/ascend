"use client";

import { useMemo, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import RenderWidget from "@/components/home/RenderWidget";

type Widget = {
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
  visible?: boolean | null;
  order_index?: number | null;
};

const NEW_DEFAULTS: Record<Widget["type"], Partial<Widget>> = {
  HERO: {
    title: "Welcome to Ascend • DMCI",
    subtitle: "Customize this hero in edit mode",
    bg_color: "#0f172a",
    image_url: "",
    cta_text: "Browse Projects",
    cta_href: "/projects",
  },
  BANNER: {
    title: "Helpful resources for buyers",
    subtitle: "Quick links and announcements",
  },
  CARD: {
    title: "Featured projects",
    data: {
      items: [
        { title: "Allegra Garden Place (AGP)", subtitle: "Pasig • Pre-selling", href: "/projects/AGP" },
        { title: "Alder Residences (ALD)", subtitle: "Taguig • Mid-rise", href: "/projects/ALD" },
      ],
    },
  },
  HTML: {
    body: "<div class='card p-6'><h3>Custom HTML</h3><p class='text-sm text-muted-foreground'>You can paste simple HTML here.</p></div>",
  },
  PROMO_CAROUSEL: {
    title: "Promos",
    subtitle: "What’s new this month",
    data: { items: [] as Array<{ image_url: string; href?: string; caption?: string }>, autoMs: 4000 },
  },
};

export default function HomeEditShellClient({
  canEdit,
  initialWidgets,
  children, // accepted to avoid TS errors if parent passes it; not used
}: {
  canEdit: boolean;
  initialWidgets: Widget[];
  children?: React.ReactNode;
}) {
  const supabase = browserSupabase();
  const [edit, setEdit] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets);

  const sorted = useMemo(
    () => [...widgets].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [widgets]
  );

  const maxOrderIndex = useMemo(
    () => Math.max(1000, ...widgets.map((w) => w.order_index ?? 0)),
    [widgets]
  );

  const patchLocal = (id: string, patch: Partial<Widget>) =>
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const updateRow = async (id: string, patch: Partial<Widget>) => {
    const { data, error } = await supabase
      .from("homepage_widgets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    patchLocal(id, data as Widget);
  };

  const move = async (id: string, dir: -1 | 1) => {
    const arr = sorted;
    const idx = arr.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;

    const a = arr[idx];
    const b = arr[j];

    try {
      await supabase.from("homepage_widgets").update({ order_index: b.order_index }).eq("id", a.id);
      await supabase.from("homepage_widgets").update({ order_index: a.order_index }).eq("id", b.id);

      setWidgets((prev) => {
        const clone = [...prev];
        const i1 = clone.findIndex((x) => x.id === a.id);
        const i2 = clone.findIndex((x) => x.id === b.id);
        if (i1 >= 0 && i2 >= 0) {
          const tmp = clone[i1].order_index ?? 0;
          clone[i1].order_index = clone[i2].order_index ?? 0;
          clone[i2].order_index = tmp;
        }
        return clone;
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const addSection = async (type: Widget["type"]) => {
    try {
      const base = NEW_DEFAULTS[type] || {};
      const insert = {
        type,
        visible: true,
        order_index: maxOrderIndex + 10,
        ...base,
      };
      const { data, error } = await supabase
        .from("homepage_widgets")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      setWidgets((prev) => [...prev, data as Widget]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this section?")) return;
    try {
      const { error } = await supabase.from("homepage_widgets").delete().eq("id", id);
      if (error) throw error;
      setWidgets((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <>
      {/* Render all sections; SectionFrame handles edit vs view */}
      <div>
        {sorted.map((w) => (
          <SectionFrame
            key={w.id}
            widget={w}
            edit={edit}
            onToggleVisible={() =>
              updateRow(w.id, { visible: !w.visible }).catch((e) => alert(e.message))
            }
            onMoveUp={() => move(w.id, -1)}
            onMoveDown={() => move(w.id, 1)}
            onDelete={() => remove(w.id)}
            onQuickSave={(patch) => updateRow(w.id, patch).catch((e) => alert(e.message))}
          >
            <RenderWidget widget={w as any} />
          </SectionFrame>
        ))}
      </div>

      {/* manager/admin controls */}
      {canEdit && (
        <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
          {edit ? (
            <div className="rounded-xl bg-white/95 backdrop-blur border shadow-lg p-2 flex items-center gap-2">
              <label className="text-xs">Add section:</label>
              <select
                className="input text-xs"
                defaultValue=""
                onChange={(e) => {
                  const t = e.currentTarget.value as Widget["type"];
                  if (!t) return;
                  addSection(t);
                  e.currentTarget.value = "";
                }}
              >
                <option value="" disabled>
                  + New…
                </option>
                <option value="HERO">Hero</option>
                <option value="BANNER">Banner</option>
                <option value="CARD">Card grid</option>
                <option value="PROMO_CAROUSEL">Promo carousel</option>
                <option value="HTML">Custom HTML</option>
              </select>
              <button className="btn btn-outline" onClick={() => setEdit(false)}>
                Exit edit
              </button>
            </div>
          ) : (
            <button className="btn btn-primary shadow-lg" onClick={() => setEdit(true)}>
              Edit homepage
            </button>
          )}
        </div>
      )}
    </>
  );
}

function SectionFrame({
  widget,
  edit,
  children,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDelete,
  onQuickSave,
}: {
  widget: Widget;
  edit: boolean;
  children: React.ReactNode;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<Widget>) => void;
}) {
  if (!edit) {
    // view mode: just render the section
    return <>{children}</>;
  }

  return (
    <div className="relative group">
      {/* floating toolbar */}
      <div className="absolute top-3 right-3 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onMoveUp}>
          ↑
        </button>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onMoveDown}>
          ↓
        </button>
        <button
          className={`btn px-2 py-1 text-xs ${widget.visible ? "btn-outline" : "btn-primary"}`}
          onClick={onToggleVisible}
        >
          {widget.visible ? "Hide" : "Show"}
        </button>
        <button className="btn btn-ghost px-2 py-1 text-xs text-red-600" onClick={onDelete}>
          ✕
        </button>
      </div>

      {/* live content */}
      {children}

      {/* quick editor */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 -mt-2 mb-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium mb-2">
            Quick edit • <span className="opacity-70">{widget.type}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <label className="block text-xs">
              Title
              <input
                className="input mt-1"
                defaultValue={widget.title ?? ""}
                onBlur={(e) => onQuickSave({ title: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs">
              Subtitle
              <input
                className="input mt-1"
                defaultValue={widget.subtitle ?? ""}
                onBlur={(e) => onQuickSave({ subtitle: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs">
              Image URL
              <input
                className="input mt-1"
                defaultValue={widget.image_url ?? ""}
                onBlur={(e) => onQuickSave({ image_url: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs md:col-span-3">
              Body (short text or HTML)
              <textarea
                className="input mt-1 min-h-[80px]"
                defaultValue={widget.body ?? ""}
                onBlur={(e) => onQuickSave({ body: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs">
              CTA text
              <input
                className="input mt-1"
                defaultValue={widget.cta_text ?? ""}
                onBlur={(e) => onQuickSave({ cta_text: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs">
              CTA href
              <input
                className="input mt-1"
                defaultValue={widget.cta_href ?? ""}
                onBlur={(e) => onQuickSave({ cta_href: e.currentTarget.value })}
              />
            </label>
            <label className="block text-xs">
              BG color
              <input
                className="input mt-1"
                defaultValue={widget.bg_color ?? ""}
                onBlur={(e) => onQuickSave({ bg_color: e.currentTarget.value })}
                placeholder="#0f172a"
              />
            </label>
            <label className="block text-xs">
              Text color
              <input
                className="input mt-1"
                defaultValue={widget.text_color ?? ""}
                onBlur={(e) => onQuickSave({ text_color: e.currentTarget.value })}
                placeholder="#ffffff"
              />
            </label>
          </div>

          <div className="text-[11px] text-muted-foreground mt-2">
            Changes save when the field loses focus.
          </div>
        </div>
      </div>
    </div>
  );
}
