/** Marks a page that isn't production-ready yet. */
export function DevBanner({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      🚧 <strong>{name}</strong> is in development — not production ready. Numbers here may be incomplete or change.
    </div>
  );
}
