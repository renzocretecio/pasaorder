import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, QrCode } from "lucide-react";
import { Brand } from "@/components/brand";
import s from "./landing.module.css";
import { LandingMotion } from "@/features/landing/landing-motion";

export const metadata: Metadata = {
  title: "PasaOrder | Orders made simple, from catalog to checkout",
  description:
    "Share an online catalog, let customers order without an account, and manage orders from one workspace built for small businesses.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: "PasaOrder",
    title: "Orders made simple, from catalog to checkout | PasaOrder",
    description:
      "Share an online catalog, let customers order without an account, and manage orders from one workspace built for small businesses.",
    url: "/",
    images: [
      {
        url: "/images/landing/merchant-counter.webp",
        width: 1672,
        height: 941,
        alt: "A neighborhood store owner managing customer orders with PasaOrder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orders made simple, from catalog to checkout | PasaOrder",
    description:
      "Share an online catalog, let customers order without an account, and manage orders from one workspace built for small businesses.",
    images: ["/images/landing/merchant-counter.webp"],
  },
};

const steps = [
  {
    title: "Make your catalog yours.",
    description:
      "Add products, prices, and photos. Publish a catalog that feels like your business, with a link and QR code ready to share.",
  },
  {
    title: "Let customers order their way.",
    description:
      "Customers choose available options, add an optional order note, and check out as a guest for pickup, delivery, or dine-in.",
  },
  {
    title: "Keep every order moving.",
    description:
      "See new orders, confirm the details, and move each one from preparing to ready in your store workspace.",
  },
];

export default function Home() {
  return (
    <LandingMotion>
      <div className={s.page}>
        <a href="#main-content" className={s.skipLink}>
          Skip to content
        </a>
        <header className={s.header}>
          <div className={s.headerInner}>
            <Link href="/" aria-label="PasaOrder home" className={s.brandLink}>
              <Brand />
            </Link>
            <nav className={s.desktopNav} aria-label="Main navigation">
              <a href="#how-it-works">How it works</a>
              <a href="#for-your-store">For your store</a>
            </nav>
            <div className={s.headerActions}>
              <Link href="/login" className={s.signIn}>
                Sign in
              </Link>
              <Link href="/register" className={s.headerCta}>
                Get started <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          <section className={s.hero} aria-labelledby="hero-title">
            <div className={s.heroInner}>
              <div className={s.heroCopy}>
                <h1 id="hero-title">
                  Orders made simple,
                  <br />
                  <span>from catalog to checkout.</span>
                </h1>
                <div className={s.heroSupport}>
                  <p>
                    Give customers an easy way to order from your business.
                    Share a catalog, let them choose product options and add a
                    note, then manage orders in one simple workspace.
                  </p>
                  <div className={s.heroActions}>
                    <Link href="/register" className={s.primaryCta}>
                      Create your account{" "}
                      <ArrowUpRight aria-hidden="true" size={19} />
                    </Link>
                    <a href="#how-it-works" className={s.heroTextLink}>
                      See how it works{" "}
                      <ArrowRight aria-hidden="true" size={18} />
                    </a>
                  </div>
                  <span className={s.heroFootnote}>
                    No customer account required. Made for independent shops,
                    sellers, and local businesses.
                  </span>
                </div>
              </div>
              <div className={s.heroImage}>
                <Image
                  src="/images/landing/merchant-counter.webp"
                  alt="A neighborhood store owner checking an order on her phone at the counter"
                  fill
                  priority
                  sizes="(max-width: 1440px) 100vw, 1280px"
                  className={s.coverImage}
                />
                <div className={s.imageCaption}>
                  Built around the way your store already works.
                </div>
              </div>
            </div>
          </section>

          <div
            className={s.handoff}
            aria-label="From catalog to order management"
          >
            <div className={s.handoffInner}>
              <span>Online catalog</span>
              <ArrowRight aria-hidden="true" />
              <span>Customer checkout</span>
              <ArrowRight aria-hidden="true" />
              <span>One order queue</span>
            </div>
          </div>

          <section
            id="how-it-works"
            className={s.how}
            aria-labelledby="how-title"
          >
            <div className={s.sectionHeading} data-reveal>
              <h2 id="how-title">
                One clear path, from first tap to fulfilled order.
              </h2>
              <p>
                PasaOrder connects your products, customer choices, and order
                queue without making your business learn a complicated system.
              </p>
            </div>
            <div className={s.steps}>
              {steps.map((step, index) => (
                <div className={s.step} key={step.title}>
                  <span className={s.stepIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="for-your-store"
            className={s.menuSection}
            aria-labelledby="menu-title"
          >
            <div className={s.menuImage}>
              <Image
                src="/images/landing/customer-qr.webp"
                alt="A customer scanning a QR code at a small neighborhood store"
                fill
                sizes="(max-width: 800px) 100vw, 45vw"
                className={s.coverImage}
              />
            </div>
            <div className={s.menuCopy} data-reveal>
              <div className={s.featureIcon} aria-hidden="true">
                <QrCode size={23} strokeWidth={1.8} />
              </div>
              <h2 id="menu-title">Your catalog, one scan away.</h2>
              <p>
                Share a QR code or send your catalog link anywhere. Customers
                browse what is available, choose product options, add an
                optional note, and submit from their phone.
              </p>
              <ul className={s.checkList}>
                <li>
                  <Check aria-hidden="true" /> A shareable storefront for your
                  products
                </li>
                <li>
                  <Check aria-hidden="true" /> Sizes, colors, extras, photos,
                  and availability
                </li>
                <li>
                  <Check aria-hidden="true" /> Pickup, delivery, or dine-in
                  options with simple order notes
                </li>
              </ul>
            </div>
          </section>

          <section className={s.close} aria-labelledby="close-title">
            <div className={s.closeInner}>
              <div>
                <h2 id="close-title">
                  A simpler day starts with one place for orders.
                </h2>
                <p>
                  Set up your catalog, share your link, and keep orders moving.
                </p>
              </div>
              <Link href="/register" className={s.closeCta}>
                Create your account{" "}
                <ArrowUpRight aria-hidden="true" size={19} />
              </Link>
            </div>
          </section>
        </main>

        <footer className={s.footer}>
          <div className={s.footerInner}>
            <Link href="/" aria-label="PasaOrder home" className={s.brandLink}>
              <Brand />
            </Link>
            <p>For the business you&apos;re building.</p>
            <div className="flex flex-wrap items-center gap-5 text-sm">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/login">
                Store owner sign in{" "}
                <ArrowUpRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </LandingMotion>
  );
}
