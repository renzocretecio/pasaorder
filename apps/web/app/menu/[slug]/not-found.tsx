export default function MenuNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f5ef] px-6 text-[#18251d]">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-[#244d35]">PasaOrder</p>
        <h1 className="mt-5 text-[28px] font-[650] leading-tight tracking-tight">
          This menu isn’t available.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#59685d]">
          The store may still be setting up its catalog. Check the link or ask
          the store for its latest menu.
        </p>
      </div>
    </main>
  );
}
