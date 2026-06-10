export default function Spinner({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-on-surface-variant">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
