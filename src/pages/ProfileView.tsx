export default function ProfileView() {
  return (
    <div className="relative flex flex-1 overflow-hidden bg-surface">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent-cyan/5 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/5 blur-[128px]" />
    </div>
  );
}
