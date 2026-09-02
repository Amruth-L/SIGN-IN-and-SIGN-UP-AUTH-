import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function HandoverCredential({ deliveryId, stage, title }) {
  const { api } = useAuth();
  const [credential, setCredential] = useState();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get(
        `/api/delivery/${deliveryId}/handover/${stage}`,
      );
      setCredential(data);
    } catch (e) {
      setError(e.response?.data?.error || "Credential is not available yet.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-ink/10 bg-white p-4 text-center">
      <KeyRound size={19} />
      <b className="block">{title}</b>
      {credential ? (
        <>
          <QRCodeSVG
            value={JSON.stringify(credential.qr)}
            size={150}
            level="M"
          />
          <div className="my-3 text-3xl font-black tracking-[.22em]">
            {credential.otp}
          </div>
          <small className="block text-ink/50">
            Single-use · expires{" "}
            {new Date(credential.expiresAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
          <button
            className="mx-auto mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
            onClick={issue}
          >
            <RefreshCw size={13} /> Regenerate
          </button>
        </>
      ) : (
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
          onClick={issue}
          disabled={busy}
        >
          {busy ? "Generating…" : "Show secure QR & OTP"}
        </button>
      )}
      {error && (
        <small className="mt-2 block text-red-600">
          {error}
        </small>
      )}
    </div>
  );
}
