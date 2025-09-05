"use client";

import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import type { HomeWidget, WidgetKind, Visibility } from "@/lib/home-widgets";
import { defaultPayload } from "@/lib/home-widgets";

type Props = { initialWidgets: HomeWidget[] };

const KINDS: { value: WidgetKind; label: string }[] = [
  { value: "HERO", label: "Hero" },
  { value: "FEATURE_GRID", label: "Feature Grid" },
  { value: "FEATURED_PROJECTS", label: "Featured Projects" },
  { value: "PROMO_CAROUSEL", label: "Promo Carousel" },
  { value: "CUSTOM_HTML", label: "Custom HTML" },
];

export default function AppearanceClient({ initialWidgets }: Props) {
  const supabase = browserSupabase();

  const [widgets, setWidgets] = useState<HomeWidget[]>(initialWidgets);
  const [selectedId, setSelectedId] = useState<string | null>(widgets[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const selected = useMemo(() => widgets.find(w => w.id === selectedId) || null, [widgets, selectedId]);

  // Create
  const createWidget = async (kind: WidgetKind) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("home_widgets")
      .insert({
        kind,
        title: "",
        subtitle: "",
        payload: defaultPayload(kind),
        order_index: (widgets[widgets.length - 1]?.order_index ?? 1000) + 10,
        visibility: "PUBLIC",
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) return alert(error.message);
    setWidgets(prev => [...prev, data as HomeWidget]);
    setSelectedId(data!.id);
  };

  // Save edits
  const saveSelected = async (patch: Partial<HomeWidget>) => {
    if (!selected) return;
    setSaving(true);
    const next = { ...selected, ...patch };
    const { data, error } = await supabase
      .from("home_widgets")
      .update({
        title: next.title,
        subtitle: next.subtitle,
        payload: next.payload,
        visibility: next.visibility,
      })
      .eq("id", selected.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) return alert(error.message);
    setWidgets(prev => prev.map(w => (w.id === selected.id ? (data as HomeWidget) : w)));
  };

  // Reorder
  const move = async (id: string, dir: -1 | 1) => {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= widgets.length) return;
    // swap order_index
    const a = widgets[idx], b = widgets[j];
    const { error: e1 } = await supabase.from("home_widgets").update({ order_index: b.order_index }).eq("id", a.id);
    const { error: e2 } = await supabase.from("home_widgets").update({ order_index: a.order_index }).eq("id", b.id);
    if (e1 || e2) return alert((e1||e2)!.message);
    const clone = [...widgets];
    [clone[idx], clone[j]] = [clone[j], clone[idx]];
    setWidgets(clone);
    setSelectedId(clone[j].id);
  };

  // Delete
  const remove = async (id: string) => {
    if (!confirm("Remove this widget?")) return;
    const { error } = await supabase.from("home_widgets").delete().eq("id", id);
    if (error) return alert(error.message);
    setWidgets(prev => prev.filter(w => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Upload image to bucket 'home' (returns public URL)
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const path = `widgets/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("home").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("home").getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Homepage Appearance</h1>
          <p className="text-sm text-muted-foreground">Add/reorder sections, toggle visibility, upload images.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              const k = e.target.value as WidgetKind;
              if (!k) return;
              createWidget(k);
              e.currentTarget.value = "";
            }}
          >
            <option value="" disabled>+ New widget…</option>
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* List */}
        <aside className="card p-3">
          <div className="text-sm font-medium mb-2">Widgets</div>
          <ul className="space-y-2">
            {widgets.map((w, i) => (
              <li key={w.id} className={`rounded-lg border p-3 ${selectedId===w.id ? "border-[color:var(--primary)]" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setSelectedId(w.id)} className="text-left">
                    <div className="text-sm font-medium">{w.title || w.kind}</div>
                    <div className="text-xs text-muted-foreground">{w.kind} • {w.visibility}</div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost px-2 py-1" onClick={() => move(w.id, -1)} disabled={i===0}>↑</button>
                    <button className="btn btn-ghost px-2 py-1" onClick={() => move(w.id,  1)} disabled={i===widgets.length-1}>↓</button>
                    <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => remove(w.id)}>✕</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <section className="card p-4">
          {!selected ? (
            <div className="text-muted-foreground">Select a widget on the left to edit.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-sm">
                  Title
                  <input
                    className="input mt-1"
                    value={selected.title || ""}
                    onChange={(e)=>saveSelected({ title: e.target.value })}
                    placeholder="Section title"
                  />
                </label>
                <label className="block text-sm">
                  Subtitle
                  <input
                    className="input mt-1"
                    value={selected.subtitle || ""}
                    onChange={(e)=>saveSelected({ subtitle: e.target.value })}
                    placeholder="Optional subtitle"
                  />
                </label>
                <label className="block text-sm">
                  Visibility
                  <select
                    className="input mt-1"
                    value={selected.visibility}
                    onChange={(e)=>saveSelected({ visibility: e.target.value as Visibility })}
                  >
                    <option value="PUBLIC">Public (clients & guests)</option>
                    <option value="STAFF">Staff (agents/managers only)</option>
                  </select>
                </label>
                <div className="text-sm text-muted-foreground grid items-end">
                  <span>Kind: <b>{selected.kind}</b></span>
                </div>
              </div>

              {/* Kind-specific editors */}
              {selected.kind === "HERO" && (
                <HeroEditor
                  payload={selected.payload}
                  onChange={(payload) => saveSelected({ payload })}
                  onUpload={uploadImage}
                  uploading={uploading}
                />
              )}

              {selected.kind === "FEATURE_GRID" && (
                <FeatureGridEditor
                  payload={selected.payload}
                  onChange={(payload) => saveSelected({ payload })}
                />
              )}

              {selected.kind === "FEATURED_PROJECTS" && (
                <FeaturedProjectsEditor
                  payload={selected.payload}
                  onChange={(payload) => saveSelected({ payload })}
                  onUpload={uploadImage}
                  uploading={uploading}
                />
              )}

              {selected.kind === "CUSTOM_HTML" && (
                <label className="block text-sm">
                  HTML
                  <textarea
                    className="input mt-1 min-h-[160px]"
                    value={selected.payload?.html || ""}
                    onChange={(e)=>saveSelected({ payload: { ...(selected.payload||{}), html: e.target.value } })}
                  />
                </label>
              )}

              <div className="text-xs text-muted-foreground">
                {saving ? "Saving…" : "All changes auto-saved."}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- Small field editors ---------- */

function HeroEditor({ payload, onChange, onUpload, uploading }:{
  payload:any; onChange:(p:any)=>void; onUpload:(f:File)=>Promise<string|null>; uploading:boolean;
}) {
  const set = (patch:any) => onChange({ ...(payload||{}), ...patch });
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Background image URL
        <div className="mt-1 flex items-center gap-2">
          <input className="input flex-1" value={payload?.image_url || ""} onChange={(e)=>set({ image_url: e.target.value })} />
          <input
            type="file"
            accept="image/*"
            onChange={async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const url=await onUpload(f); if(url) set({ image_url:url }); }}
            disabled={uploading}
          />
        </div>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(payload?.ctas || []).map((c:any, idx:number)=>(
          <div key={idx} className="rounded-lg border p-3">
            <div className="text-xs font-medium mb-2">CTA #{idx+1}</div>
            <label className="block text-xs">
              Label
              <input className="input mt-1" value={c.label||""} onChange={(e)=> {
                const next=[...payload.ctas]; next[idx]={...next[idx], label:e.target.value}; set({ ctas:next });
              }}/>
            </label>
            <label className="block text-xs mt-2">
              Href
              <input className="input mt-1" value={c.href||""} onChange={(e)=> {
                const next=[...payload.ctas]; next[idx]={...next[idx], href:e.target.value}; set({ ctas:next });
              }}/>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureGridEditor({ payload, onChange }:{ payload:any; onChange:(p:any)=>void }) {
  const set = (patch:any) => onChange({ ...(payload||{}), ...patch });
  const items = payload?.items || [];
  return (
    <div className="space-y-3">
      <div className="text-sm">Cards</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((it:any, idx:number)=>(
          <div key={idx} className="rounded-lg border p-3">
            <label className="block text-xs">
              Title
              <input className="input mt-1" value={it.title||""} onChange={(e)=> {
                const next=[...items]; next[idx]={...next[idx], title:e.target.value}; set({ items:next });
              }}/>
            </label>
            <label className="block text-xs mt-2">
              Description
              <input className="input mt-1" value={it.desc||""} onChange={(e)=> {
                const next=[...items]; next[idx]={...next[idx], desc:e.target.value}; set({ items:next });
              }}/>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedProjectsEditor({ payload, onChange, onUpload, uploading }:{
  payload:any; onChange:(p:any)=>void; onUpload:(f:File)=>Promise<string|null>; uploading:boolean;
}) {
  const set = (patch:any) => onChange({ ...(payload||{}), ...patch });
  const cards = payload?.cards || [];
  return (
    <div className="space-y-3">
      <div className="text-sm">Project cards</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c:any, idx:number)=>(
          <div key={idx} className="rounded-lg border p-3 space-y-2">
            <label className="block text-xs">
              Title
              <input className="input mt-1" value={c.title||""} onChange={(e)=> {
                const next=[...cards]; next[idx]={...next[idx], title:e.target.value}; set({ cards:next });
              }}/>
            </label>
            <label className="block text-xs">
              Link
              <input className="input mt-1" value={c.href||""} onChange={(e)=> {
                const next=[...cards]; next[idx]={...next[idx], href:e.target.value}; set({ cards:next });
              }}/>
            </label>
            <label className="block text-xs">
              Tags (comma-separated)
              <input className="input mt-1" value={(c.tags||[]).join(", ")} onChange={(e)=> {
                const next=[...cards]; next[idx]={...next[idx], tags:e.target.value.split(",").map((s)=>s.trim()).filter(Boolean)}; set({ cards:next });
              }}/>
            </label>
            <label className="block text-xs">
              Image URL
              <div className="mt-1 flex items-center gap-2">
                <input className="input flex-1" value={c.image_url||""} onChange={(e)=> {
                  const next=[...cards]; next[idx]={...next[idx], image_url:e.target.value}; set({ cards:next });
                }}/>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const url=await onUpload(f); if(url){ const next=[...cards]; next[idx]={...next[idx], image_url:url}; set({ cards:next }); }}}
                  disabled={uploading}
                />
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
