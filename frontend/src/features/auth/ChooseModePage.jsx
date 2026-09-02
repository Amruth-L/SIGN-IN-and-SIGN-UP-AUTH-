import { motion } from "motion/react";
import { ArrowRight, Box, MapPin, Route, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ChooseMode() {
  const { user, setMode } = useAuth();
  const navigate = useNavigate();
  const choose = async (mode) => {
    await setMode(mode);
    navigate(mode === "DELIVERY" ? "/delivery" : "/marketplace");
  };
  return (
    <main className="relative min-h-[calc(100vh-4.25rem)] overflow-hidden bg-paper">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(105,211,157,.20),transparent_26%),radial-gradient(circle_at_80%_70%,rgba(61,121,255,.10),transparent_28%)]" />
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 relative z-10 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mesh-900/10 bg-white/80 px-3 py-1 text-xs font-bold text-mesh-700">
            <MapPin size={14} /> CampusMesh workspace
          </span>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-none sm:text-6xl">
            Choose a workspace.
          </h1>
          <p className="mt-5 text-ink/50">
            Switch anytime.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {[
            [
              "RENT",
              Box,
              "Rent and share",
              "Browse, rent, and list items.",
              "bg-mesh-100 text-mesh-800",
            ],
            [
              "DELIVERY",
              Truck,
              "Deliver along your route",
              "Set a route and take deliveries.",
              "bg-blue-100 text-blue-700",
            ],
          ].map(([mode, Icon, title, copy, color], index) => (
            <motion.button
              key={mode}
              onClick={() => choose(mode)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] relative overflow-hidden p-7 text-left sm:p-9"
            >
              <span
                className={`grid size-14 place-items-center rounded-2xl ${color}`}
              >
                <Icon size={27} />
              </span>
              <h2 className="mt-10 text-2xl font-extrabold">{title}</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-ink/50">
                {copy}
              </p>
              <span className="mt-8 flex items-center gap-2 text-sm font-extrabold text-mesh-700">
                Open{" "}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </span>
              {mode === "DELIVERY" && (
                <Route className="absolute -bottom-8 -right-7 size-36 text-blue-500/8" />
              )}
            </motion.button>
          ))}
        </div>
        <p className="mt-8 text-center text-xs font-semibold text-ink/35">
          Signed in as {user?.name}
        </p>
      </div>
    </main>
  );
}
