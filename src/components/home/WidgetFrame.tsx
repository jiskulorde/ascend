import React from "react";

export default function WidgetFrame({
  id,
  canEdit,
  children,
}: {
  id: string;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  if (!canEdit) return <>{children}</>;

  return (
    <div className="relative group">
      {/* the content */}
      {children}

      {/* edit chip, visible for managers/admins only */}
      <a
        href={`/dashboard/appearance?focus=${encodeURIComponent(id)}`}
        className="hidden md:inline-flex items-center gap-1 rounded-full border border-border bg-white/95 px-3 py-1 text-xs shadow-sm
                   hover:bg-white absolute top-3 right-3 group-hover:flex"
        title="Edit this section"
      >
        ✎ Edit
      </a>
    </div>
  );
}
