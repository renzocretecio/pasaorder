import Link from "next/link";
import { Brand } from "@/components/brand";

export type LegalSection = {
  title: string;
  content: React.ReactNode;
};

export function LegalDocument({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-dvh bg-[#f8faf7] text-[#18251d]">
      <header className="border-b border-[#d6dfd6] bg-[#f8faf7]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="PasaOrder home">
            <Brand />
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-[#244d35] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#173d2c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#37794b]"
          >
            Get started
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[220px_minmax(0,760px)] lg:gap-16">
        <aside className="lg:sticky lg:top-8 lg:h-fit">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#59685d]">
            Legal
          </p>
          <nav aria-label="Legal pages" className="mt-3 flex gap-2 lg:flex-col">
            <Link
              href="/privacy"
              className="rounded-lg px-3 py-2 text-sm text-[#59685d] hover:bg-white hover:text-[#18251d]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="rounded-lg px-3 py-2 text-sm text-[#59685d] hover:bg-white hover:text-[#18251d]"
            >
              Terms of Service
            </Link>
          </nav>
        </aside>

        <article className="min-w-0">
          <p className="text-sm font-medium text-[#37794b]">PasaOrder</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#59685d]">
            {summary}
          </p>
          <p className="mt-5 text-sm text-[#59685d]">
            Last updated October 16, 2026
          </p>

          <div className="mt-9 border-t border-[#d6dfd6]">
            {sections.map((section, index) => (
              <section
                key={section.title}
                id={`section-${index + 1}`}
                className="scroll-mt-8 border-b border-[#d6dfd6] py-7 sm:py-8"
              >
                <h2 className="text-lg font-semibold tracking-[-0.015em]">
                  {section.title}
                </h2>
                <div className="legal-copy mt-3 space-y-4 text-[15px] leading-7 text-[#435247]">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>

      <footer className="border-t border-[#d6dfd6]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-[#59685d] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© 2026 PasaOrder</span>
          <div className="flex gap-5">
            <Link className="hover:text-[#18251d]" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-[#18251d]" href="/terms">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
