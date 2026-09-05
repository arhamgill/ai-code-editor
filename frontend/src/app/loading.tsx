export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-border">
        <div
          className="h-full w-1/4 rounded-full bg-brand"
          style={{ animation: "forge-progress 1.1s var(--ease-out-quint) infinite" }}
        />
      </div>
    </div>
  );
}
