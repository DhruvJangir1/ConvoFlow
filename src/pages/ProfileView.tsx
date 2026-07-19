export default function ProfileView() {
  return (
    <div className="relative flex flex-1 overflow-hidden bg-surface">
      <div className="pointer-events-none absolute -left-20 sm:-left-40 -top-20 sm:-top-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent-cyan/5 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-20 sm:-bottom-40 -right-20 sm:-right-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent/5 blur-[128px]" />
    </div>
  );
}
