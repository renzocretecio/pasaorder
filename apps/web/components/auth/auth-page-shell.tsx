import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Brand } from "@/components/brand";
import { StorefrontIllustration } from "@/components/auth/storefront-illustration";

export function AuthPageShell({ mode }: { mode: "login" | "register" }) {
  const signingUp = mode === "register";
  return (
    <main
      style={{
        paddingTop: "max(var(--auth-gutter), env(safe-area-inset-top))",
        paddingBottom: "max(var(--auth-gutter), env(safe-area-inset-bottom))",
      }}
      className="min-h-svh bg-auth-background [--auth-gutter:1.25rem] p-5 sm:[--auth-gutter:2rem] xl:[--auth-gutter:2.5rem] selection:bg-primary selection:text-white sm:p-8 xl:p-10"
    >
      <div className="mx-auto grid min-h-[calc(100svh-2.5rem)] max-w-[1440px] xl:min-h-[calc(100svh-5rem)] xl:grid-cols-2">
        <section className="flex min-w-0 flex-col px-1 py-3 sm:px-6 xl:px-16 xl:py-6">
          <header className="mx-auto w-full max-w-[390px]">
            <Link href="/" className="inline-flex" aria-label="PasaOrder home">
              <Brand />
            </Link>
          </header>
          <div
            className={`flex flex-1 items-center ${signingUp ? "py-10 sm:py-12" : "py-16 xl:py-20"}`}
          >
            <div className="mx-auto w-full max-w-[390px]">
              <h1 className="text-balance text-[40px] font-semibold leading-[1.15] tracking-[-0.04em] sm:text-5xl">
                {signingUp ? "Create your account." : "Welcome back."}
              </h1>
              <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-muted-foreground">
                {signingUp
                  ? "A home for your business starts with you. Create your owner account to get started."
                  : "Sign in to your PasaOrder workspace. Pick up where you left off."}
              </p>
              <AuthForm mode={mode} />
            </div>
          </div>
          <footer className="mx-auto w-full max-w-[390px] border-t border-primary/15 pt-5 text-[13px] leading-[1.4] text-muted-foreground">
            PasaOrder · For the business you’re building.
          </footer>
        </section>
        <aside className="hidden items-center justify-center p-6 xl:flex xl:p-8">
          <div className="flex min-h-[660px] w-full flex-col justify-between overflow-hidden rounded-[32px] bg-auth-forest px-8 py-8 text-[#f7f8ee] xl:min-h-[700px] xl:px-10">
            <p className="text-sm text-[#c4d4c6]">
              Your store. Your customers. Your way.
            </p>
            <div className="py-8">
              <StorefrontIllustration />
              <div className="mt-7">
                <p className="max-w-md text-pretty text-4xl font-medium leading-[1.15] tracking-[-0.035em]">
                  {signingUp
                    ? "Your next chapter starts here."
                    : "A workspace to call your own."}
                </p>
                <p className="mt-5 max-w-sm text-base leading-relaxed text-[#c4d4c6]">
                  {signingUp
                    ? "From a neighborhood favorite to something entirely new. There’s room for your business here."
                    : "For the menus, catalogs, and everyday details that make your business your own."}
                </p>
              </div>
            </div>
            <p className="border-t border-white/20 pt-5 text-xs text-[#c4d4c6]">
              A place for the people behind the business.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
