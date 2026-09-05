// src/components/shortlists/ShortlistsClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Plus, Pencil, Trash2, FolderOpen, AlertCircle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClientShortlist } from "@/lib/shortlists/types";
import ShortlistFormDialog from "@/components/shortlists/ShortlistFormDialog";
import DeleteShortlistDialog from "@/components/shortlists/DeleteShortlistDialog";

type LoadState = "loading" | "ready" | "unauthorized" | "error";

export default function ShortlistsClient() {
  const router = useRouter();

  const [shortlists, setShortlists] = useState<ClientShortlist[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientShortlist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientShortlist | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/shortlists");
      if (res.status === 401) {
        setState("unauthorized");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = await res.json();
      setShortlists(Array.isArray(json.shortlists) ? json.shortlists : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleCreated(shortlist: ClientShortlist) {
    setShortlists((prev) => [shortlist, ...prev]);
  }

  function handleUpdated(shortlist: ClientShortlist) {
    setShortlists((prev) => prev.map((s) => (s.id === shortlist.id ? shortlist : s)));
  }

  function handleDeleted(id: string) {
    setShortlists((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Client Shortlists
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save and organize property options for each client.
          </p>
        </div>

        {state === "ready" && shortlists.length > 0 && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            New Shortlist
          </Button>
        )}
      </div>

      <div className="mt-6">
        {state === "loading" && <LoadingSkeleton />}

        {state === "unauthorized" && (
          <StatusCard
            icon={<AlertCircle className="h-6 w-6 text-destructive" />}
            title="Your session has expired"
            description="Please sign in again to view your client shortlists."
            action={
              <Button onClick={() => router.push("/auth/login?next=/shortlists")}>Sign in</Button>
            }
          />
        )}

        {state === "error" && (
          <StatusCard
            icon={<AlertCircle className="h-6 w-6 text-destructive" />}
            title="Couldn't load your shortlists"
            description="Something went wrong. Please try again."
            action={
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            }
          />
        )}

        {state === "ready" && shortlists.length === 0 && (
          <StatusCard
            icon={<FolderPlus className="h-6 w-6 text-muted-foreground" />}
            title="No client shortlists yet"
            description="Create your first shortlist to start saving property options for a client."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Shortlist
              </Button>
            }
          />
        )}

        {state === "ready" && shortlists.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortlists.map((shortlist) => (
              <ShortlistCard
                key={shortlist.id}
                shortlist={shortlist}
                onOpen={() => router.push(`/shortlists/${shortlist.id}`)}
                onEdit={() => setEditTarget(shortlist)}
                onDelete={() => setDeleteTarget(shortlist)}
              />
            ))}
          </div>
        )}
      </div>

      <ShortlistFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={handleCreated} />

      <ShortlistFormDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        target={editTarget}
        onSaved={handleUpdated}
      />

      <DeleteShortlistDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        target={deleteTarget}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function ShortlistCard({
  shortlist,
  onOpen,
  onEdit,
  onDelete,
}: {
  shortlist: ClientShortlist;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground" title={shortlist.name}>
              {shortlist.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Updated {formatDistanceToNow(new Date(shortlist.updated_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Rename or edit ${shortlist.name}`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${shortlist.name}`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2.5em] text-xs text-muted-foreground">
        {shortlist.notes || "No notes yet."}
      </p>

      <Button variant="secondary" size="sm" className="mt-1 w-full" onClick={onOpen}>
        Open Shortlist
      </Button>
    </Card>
  );
}

function StatusCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading shortlists"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </Card>
      ))}
    </div>
  );
}
