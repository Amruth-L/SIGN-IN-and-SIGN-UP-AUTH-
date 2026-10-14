import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Play, Volume2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
const field =
  "mt-2 w-full rounded-lg border border-ink/15 px-3 py-3 text-sm outline-none focus:border-mesh-600";
export default function ReminderPage() {
  const { api } = useAuth();
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const refresh = () => setVoices(synth.getVoices());
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);
  const [data, setData] = useState(null),
    [form, setForm] = useState({
      phone_e164: "",
      reminders_enabled: false,
      recommendations_enabled: false,
    }),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState("");
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/api/calls");
      setData(data);
      setForm({
        phone_e164: data.preferences.phone_e164 || "",
        reminders_enabled: data.preferences.reminders_enabled,
        recommendations_enabled: data.preferences.recommendations_enabled,
      });
    } catch (e) {
      setNotice(e.response?.data?.error || "Could not load reminder settings.");
    }
  }, [api]);
  useEffect(() => {
    load();
    return () => window.speechSynthesis?.cancel();
  }, [load]);
  const action = async (type, e) => {
    e?.preventDefault();
    setBusy(type);
    setNotice("");
    try {
      if (type === "save") {
        await api.put("/api/calls/preferences", form);
        await load();
        setNotice(
          "Preferences saved. You can turn either type of call off at any time.",
        );
      } else if (type === "preview") {
        const { data } = await api.get("/api/calls/preview");
        setPreview(data);
      } else {
        const { data } = await api.post(
          "/api/calls/verify-phone",
          type === "confirm" ? { code } : {},
        );
        setNotice(
          data.verified ? "Phone verified." : "Verification code sent by SMS.",
        );
        await load();
      }
    } catch (e) {
      setNotice(e.response?.data?.error || "Could not complete this action.");
    } finally {
      setBusy("");
    }
  };
  const listen = (text) => {
    if (!window.speechSynthesis) {
      setNotice(
        "Audio preview is not supported in this browser. Read the script below.",
      );
      return;
    }
    const available = window.speechSynthesis.getVoices();
    // SpeechSynthesis has no gender field; prefer known female English voices.
    const female = (available.length ? available : voices).filter(
      (v) =>
        /^en[-_]/i.test(v.lang) &&
        /\b(veena|aditi|raveena|samantha|victoria|karen|moira|tessa|serena|susan|zira|aria|jenny|sonia|female)\b/i.test(
          v.name,
        ),
    );
    const voice = female.find((v) => /^en[-_]IN$/i.test(v.lang)) || female[0];
    if (!voice) {
      setNotice(
        "A female English voice is not available in this browser yet. Enable one in your device’s speech settings, then refresh to hear the preview.",
      );
      return;
    }
    setNotice("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.85;
    utterance.onerror = () =>
      setNotice("The voice preview could not play. Please try again.");
    window.speechSynthesis.speak(utterance);
  };
  return (
    <main className="page-shell pb-28">
      <header>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mesh-700">
          Stay on track
        </p>
        <h1 className="page-title">Reminder calls</h1>
        <p className="page-copy">
          Choose which updates you want to hear. English first.
        </p>
      </header>
      {notice && (
        <p
          role="status"
          className="my-5 rounded-lg bg-mesh-50 p-4 text-sm text-mesh-800"
        >
          {notice}
        </p>
      )}
      {!data ? (
        <p className="mt-8 text-sm">Loading settings…</p>
      ) : (
        <>
          <div
            className={`my-6 flex items-start gap-3 rounded-xl border p-4 ${data.status.mode === "preview" ? "border-ink/10 bg-paper" : "border-mesh-200 bg-mesh-50"}`}
          >
            <Phone size={20} className="mt-0.5 shrink-0 text-mesh-600" />
            <div>
              <h2 className="text-sm font-semibold">
                {data.status.mode === "preview"
                  ? "Preview mode · No real calls"
                  : "Calling provider connected"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-ink/60">
                {data.status.mode === "preview"
                  ? "The calling integration is ready to configure. You can save preferences and listen to sample scripts now."
                  : data.status.schedulerEnabled
                    ? "Automatic reminders are enabled for verified, opted-in numbers."
                    : "The scheduler is paused. No automatic calls will be placed."}
              </p>
            </div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <form
              onSubmit={(e) => action("save", e)}
              className="panel space-y-5 p-5 sm:p-6"
            >
              <h2 className="text-lg font-semibold">Your preferences</h2>
              <label className="block text-xs font-medium">
                Phone number with country code
                <input
                  type="tel"
                  className={field}
                  placeholder="+91…"
                  value={form.phone_e164}
                  onChange={(e) =>
                    setForm({ ...form, phone_e164: e.target.value })
                  }
                />
              </label>
              <p className="text-xs text-ink/55">
                {data.preferences.phone_verified_at
                  ? "Phone number verified"
                  : "Phone verification is required before live calls."}
              </p>
              {[
                [
                  "reminders_enabled",
                  "Due-date reminders",
                  "A reminder the day before, on the due date, and once if overdue. Calls stop when you return the item or an extension changes the due date.",
                ],
                [
                  "recommendations_enabled",
                  "Item recommendations",
                  "Occasional suggestions based on real campus demand and your interests. This is optional and separate from rental reminders.",
                ],
              ].map(([key, title, description]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-green-700"
                    checked={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.checked })
                    }
                  />
                  <span>
                    <strong className="block text-sm">{title}</strong>
                    <span className="mt-2 block text-xs leading-5 text-ink/55">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-xs leading-5 text-ink/55">
                Enabling a switch opts you in to that type of automated
                CampusMesh call. Calls use your verified number. Disable a
                switch here or press 9 during a call to opt out.
              </p>
              <button disabled={!!busy} className="brand-button w-full">
                {busy === "save" ? "Saving…" : "Save preferences"}
              </button>
              {data.status.phoneVerificationConfigured &&
                !data.preferences.phone_verified_at && (
                  <div className="border-t border-ink/10 pt-4">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!!busy}
                      onClick={() => action("verify")}
                    >
                      Send phone verification code
                    </button>
                    <label className="mt-3 block text-xs">
                      Verification code
                      <input
                        className={field}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="brand-button mt-3"
                      disabled={!!busy || !code}
                      onClick={() => action("confirm")}
                    >
                      Verify phone
                    </button>
                  </div>
                )}
            </form>
            <section className="space-y-4">
              <div className="panel p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Volume2 size={20} className="text-mesh-600" />
                  <h2 className="text-lg font-semibold">Hear a preview</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  Soft female voice · relaxed English delivery. Review what the
                  assistant would say. Audio plays in this browser and never
                  dials a phone.
                </p>
                <button
                  className="secondary-button mt-4"
                  onClick={() => action("preview")}
                  disabled={!!busy}
                >
                  <Play size={15} />
                  {busy === "preview" ? "Preparing…" : "Generate call preview"}
                </button>
                {preview && (
                  <div className="mt-5 space-y-4">
                    {(preview.previews.length
                      ? preview.previews
                      : [preview.sample]
                    ).map((p, i) => (
                      <article key={i} className="rounded-lg bg-paper p-4">
                        <span className="text-xs font-semibold text-mesh-700">
                          {p.example
                            ? "Example only"
                            : p.kind === "DUE_REMINDER"
                              ? "Your rental reminder"
                              : "Item recommendation"}
                        </span>
                        <p className="mt-3 text-sm leading-6">{p.script}</p>
                        <button
                          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-mesh-700"
                          onClick={() => listen(p.script)}
                        >
                          <Volume2 size={15} />
                          Listen in browser
                        </button>
                      </article>
                    ))}
                    <p className="text-xs leading-5 text-ink/50">
                      {preview.note}
                    </p>
                  </div>
                )}
              </div>
              <div className="panel p-5">
                <ShieldCheck className="text-mesh-600" size={20} />
                <h2 className="mt-3 text-sm font-semibold">
                  Designed to be useful, not noisy
                </h2>
                <p className="mt-3 text-xs leading-6 text-ink/60">
                  {data.status.window}. {data.status.limits} Due-date reminders
                  take priority. Bookings and payments require action in the
                  app.
                </p>
                <Link
                  to="/support"
                  className="mt-4 inline-block text-xs font-semibold text-mesh-700"
                >
                  Ask a support question →
                </Link>
              </div>
            </section>
          </div>
          <section className="panel mt-6 p-5">
            <h2 className="font-semibold">Call history</h2>
            {!data.calls.length ? (
              <p className="mt-3 text-sm text-ink/55">
                No calls have been placed.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.calls.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-lg border border-ink/10 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      <b>
                        {c.kind === "DUE_REMINDER"
                          ? "Due-date reminder"
                          : "Recommendation"}
                      </b>
                      <span>{c.status.toLowerCase()}</span>
                    </div>
                    <p className="mt-2 text-xs text-ink/55">
                      {new Date(c.created_at).toLocaleString("en-IN")}
                      {c.outcome ? ` · ${c.outcome}` : ""}
                    </p>
                    {c.last_error && (
                      <p className="mt-2 text-xs text-ink/55">{c.last_error}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
