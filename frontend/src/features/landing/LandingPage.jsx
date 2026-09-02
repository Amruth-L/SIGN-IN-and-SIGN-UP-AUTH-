import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  FileText,
  Map,
  PackageCheck,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webImages } from "../../lib/assets";

const steps = [
  ["01", "Choose", "Find an item and pick dates."],
  ["02", "Confirm", "Review price and reserve."],
  ["03", "Match", "A courier follows the campus route."],
  ["04", "Handover", "QR confirms each exchange."],
];
export default function LandingPage() {
  const { user } = useAuth();
  return (
    <main className="overflow-hidden">
      <section className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 relative grid min-h-[calc(100vh-4.25rem)] items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div className="pointer-events-none absolute -left-40 top-10 size-96 rounded-full bg-mesh-200/50 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-10"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mesh-900/10 bg-white/80 px-3 py-1 text-xs font-bold text-mesh-700 mb-6">
            <span className="size-2 rounded-full bg-mesh-500" /> Built for one
            campus
          </span>
          <h1 className="max-w-3xl font-display text-[clamp(3.2rem,7vw,6.2rem)] font-semibold leading-[.86] tracking-[-.065em] text-ink">
            Need it.
            <br />
            <span className="text-mesh-600">Rent time,</span>
            <br />
            not clutter.
          </h1>
          <p className="mt-7 max-w-md text-base text-ink/55 sm:text-lg">
            Rent, deliver, and print on campus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link to="/choose-mode" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 h-13 px-6">
                  Continue <ArrowRight size={17} />
                </Link>
                <Link
                  to="/create-listing"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 h-13 px-6"
                >
                  List an item
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 h-13 px-6">
                  Sign up <ArrowRight size={17} />
                </Link>
                <Link to="/login" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 h-13 px-6">
                  Log in
                </Link>
              </>
            )}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="relative"
        >
          <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-white bg-white shadow-float">
            <img
              src={webImages.campus}
              className="h-[500px] w-full object-cover"
              alt=""
            />
            <div className="absolute inset-x-7 bottom-7 rounded-2xl border border-white/30 bg-white/90 p-5 shadow-xl backdrop-blur">
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Live route match</span>
              <div className="mt-2 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-mesh-600 text-white">
                  <Route />
                </div>
                <div>
                  <b className="block">Library → Boys Hostel</b>
                  <small className="text-ink/50">
                    86 match score · 6 min walk
                  </small>
                </div>
                <span className="ml-auto rounded-full bg-mesh-100 px-3 py-1 text-xs font-extrabold text-mesh-700">
                  On your way
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      <section className="border-y border-mesh-900/10 bg-mesh-50 py-16 text-ink">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">
                One connected flow
              </span>
              <h2 className="mt-3 font-display text-5xl leading-none">Four simple steps.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map(([n, title, copy], i) => (
                <motion.article
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  key={n}
                  className="rounded-2xl border border-ink/10 bg-white p-5"
                >
                  <span className="font-display text-3xl text-mesh-600">
                    {n}
                  </span>
                  <h3 className="mt-6 text-lg">{title}</h3>
                  <p className="mt-2 text-sm text-ink/50">{copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Campus services</span>
          <h2 className="mt-3 font-display text-5xl leading-none">
            Campus life, with fewer detours.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [
              PackageCheck,
              "Rent what you need",
              "Items from students nearby.",
            ],
            [
              Map,
              "Deliver along your route",
              "Accept tasks on your way.",
            ],
            [
              FileText,
              "Print without the queue",
              "Private PDF printing at ₹3/page.",
            ],
          ].map(([Icon, title, copy]) => (
            <article
              key={title}
              className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] group p-7 transition hover:-translate-y-1 hover:shadow-float"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-mesh-100 text-mesh-700 transition group-hover:rotate-3 group-hover:scale-105">
                <Icon />
              </div>
              <h3 className="mt-8 text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/55">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="border-t border-mesh-900/10 py-8">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 flex flex-wrap items-center justify-between gap-4 text-sm text-ink/45">
          <b className="text-ink">
            Campus<span className="text-mesh-600">Mesh</span>
          </b>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={15} /> Verified campus access
          </span>
        </div>
      </footer>
    </main>
  );
}
