import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { CheckCircle2, Radio, ShieldCheck, Truck, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { normalizeCampusLocations } from "../../lib/campus";
import { API_BASE_URL } from "../../lib/api";
import QrScanner from "../../components/QrScanner";
import ActiveTask from "./components/ActiveTask";
import CampusRouteMap from "./components/CampusRouteMap";
import OffersPanel from "./components/OffersPanel";
import RouteSetup from "./components/RouteSetup";

const API = API_BASE_URL;
const listFrom = (result, key) => {
  if (result.status !== "fulfilled") return [];
  const value = result.value.data;
  return Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
};
const activeStatuses = new Set(["COURIER_ASSIGNED", "ACCEPTED", "GOING_TO_PICKUP", "ARRIVED_AT_PICKUP", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "RETURN_COURIER_ASSIGNED", "RETURN_IN_TRANSIT"]);

export default function DeliveryPage() {
  const { user, api } = useAuth();
  const [campus, setCampus] = useState();
  const [locations, setLocations] = useState([]);
  const [offers, setOffers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [active, setActive] = useState();
  const [route, setRoute] = useState();
  const [declaredRoute, setDeclaredRoute] = useState();
  const [position, setPosition] = useState();
  const [stats, setStats] = useState({ available: 0, active: 0, completed: 0, totalEarned: 0 });
  const [online, setOnline] = useState(Boolean(user?.delivery_available));
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("Save a route to start receiving matched delivery requests.");
  const [scanner, setScanner] = useState(false);
  const [verify, setVerify] = useState({ stage: "PICKUP", method: "OTP", value: "" });
  const [form, setForm] = useState({ origin_location_id: "", destination_location_id: "", available_until: new Date(Date.now() + 7200000).toISOString().slice(0, 16), max_detour_meters: 250 });

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get("/api/campus"),
      api.get("/api/campus/locations"),
      api.get("/api/delivery/available"),
      api.get("/api/delivery/my-deliveries"),
      api.get("/api/courier/routes/current"),
      api.get("/api/delivery/stats"),
    ]);
    const [c, l, a, m, r, s] = results;
    if (c.status === "fulfilled") setCampus(c.value.data);
    const locationList = normalizeCampusLocations(l.status === "fulfilled" ? l.value.data : []);
    const offerList = listFrom(a, "deliveries");
    const taskList = listFrom(m, "deliveries");
    setLocations(locationList);
    setOffers(offerList);
    setTasks(taskList);
    if (s.status === "fulfilled") setStats(s.value.data);
    if (r.status === "fulfilled") {
      setOnline(Boolean(r.value.data?.route));
      setDeclaredRoute(r.value.data?.navigation);
    }
    setForm((current) => ({ ...current, origin_location_id: locationList.some((item) => item.id === current.origin_location_id) ? current.origin_location_id : locationList[0]?.id || "", destination_location_id: locationList.some((item) => item.id === current.destination_location_id) ? current.destination_location_id : locationList.find((item) => item.building_id === "hostel")?.id || locationList[1]?.id || "" }));
    const current = taskList.find((item) => activeStatuses.has(item.status));
    setActive(current);
    if (!current) setPosition(undefined);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) setNotice(failed.reason?.response?.data?.error || "Some delivery data could not be refreshed.");
  }, [api]);

  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.error || "Could not load courier workspace.")); }, [load]);
  useEffect(() => {
    const socket = io(API, { auth: { token: localStorage.getItem("token") } });
    const refresh = () => load();
    ["delivery:offer", "delivery:created", "delivery:status", "delivery:assigned", "delivery:completed"].forEach((event) => socket.on(event, refresh));
    socket.on("delivery:location", (location) => { if (location.delivery_id === active?.id) setPosition(location); });
    return () => socket.close();
  }, [active?.id, load]);

  useEffect(() => {
    if (!active?.pickup_location_id || !active?.destination_location_id) { setRoute(declaredRoute); return undefined; }
    let cancelled = false;
    api.get(`/api/campus/route?from=${encodeURIComponent(active.pickup_location_id)}&to=${encodeURIComponent(active.destination_location_id)}`).then(({ data }) => { if (!cancelled) setRoute(data); }).catch(() => { if (!cancelled) setRoute(declaredRoute); });
    return () => { cancelled = true; };
  }, [active?.id, active?.pickup_location_id, active?.destination_location_id, api, declaredRoute]);

  const pickup = useMemo(() => locations.find((item) => item.id === active?.pickup_location_id), [locations, active]);
  const destination = useMemo(() => locations.find((item) => item.id === active?.destination_location_id), [locations, active]);
  const completed = Number(stats.completed ?? tasks.filter((item) => item.status === "COMPLETED").length);
  const available = Number(stats.available ?? offers.length);
  const activeCount = Number(stats.active ?? tasks.filter((item) => activeStatuses.has(item.status)).length);

  const saveRoute = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post("/api/courier/routes", { ...form, available_until: new Date(form.available_until).toISOString() });
      setOnline(true); setDeclaredRoute(data.route); setNotice("You are online. Matching delivery requests in real time."); await load();
    } catch (error) { setNotice(error.response?.data?.error || "Could not save route."); }
  };
  const toggleOnline = async () => {
    try { if (online) { await api.delete("/api/courier/routes/current"); setOnline(false); setNotice("You are offline. New delivery requests are paused."); } else setNotice("Save a route to go online."); } catch (error) { setNotice(error.response?.data?.error || "Could not update availability."); }
  };
  const accept = async (offer) => {
    setBusyId(offer.delivery_id);
    try { await api.post(`/api/delivery/${offer.delivery_id}/accept`); setNotice("Delivery accepted. It is now locked to you."); await load(); } catch (error) { setNotice(error.response?.data?.error || "That delivery is no longer available."); } finally { setBusyId(""); }
  };
  const decline = async (offer) => {
    setBusyId(offer.delivery_id);
    try { await api.post(`/api/delivery/${offer.delivery_id}/decline`); setNotice("Request skipped."); await load(); } catch (error) { setNotice(error.response?.data?.error || "Could not skip this request."); } finally { setBusyId(""); }
  };
  const checkpoint = async (target) => {
    const location = target === "pickup" ? pickup : destination;
    if (!active || !location) return;
    try { const point = { x: Number(location.x), y: Number(location.y), route_node_id: location.route_node_id, speed: 5 }; await api.post(`/api/delivery/${active.id}/location`, point); setPosition({ ...point, delivery_id: active.id }); setNotice("Live checkpoint shared with the renter and owner."); } catch (error) { setNotice(error.response?.data?.error || "Could not share this checkpoint."); }
  };
  const advance = async (status) => {
    if (!active) return;
    try { await api.post(`/api/delivery/${active.id}/status`, { status }); setNotice(`Delivery moved to ${status.replaceAll("_", " ").toLowerCase()}.`); await load(); } catch (error) { setNotice(error.response?.data?.error || "That step is not available yet."); }
  };
  const confirm = async () => {
    if (!active || !verify.value.trim()) return;
    try {
      let value = verify.value.trim();
      if (verify.method === "QR") { try { value = JSON.parse(value); } catch { value = { token: value }; } }
      await api.post(`/api/delivery/${active.id}/verify-handover`, { stage: verify.stage, method: verify.method, value });
      setVerify((current) => ({ ...current, value: "" })); setNotice(`${verify.stage.replaceAll("_", " ")} verified. The next stage is now unlocked.`); await load();
    } catch (error) { setNotice(error.response?.data?.error || "Credential verification failed."); }
  };

  return (
    <main className="min-h-screen bg-paper pb-16">
      {scanner && <QrScanner onClose={() => setScanner(false)} onResult={(value) => { setVerify((current) => ({ ...current, method: "QR", value })); setScanner(false); }} />}
      <header className="border-b border-ink/10 bg-[radial-gradient(circle_at_78%_0%,rgba(43,112,68,.16),transparent_34%)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-9 sm:px-7 lg:px-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><span className="flex items-center gap-1.5 text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600"><Radio size={13} /> Campus courier network</span><h1 className="mt-3 max-w-[28rem] font-display text-5xl font-semibold leading-[.98]">Make one campus trip do more.</h1><p className="mt-3 max-w-[32rem] text-sm leading-6 text-ink/55">{notice}</p></div>
            <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold ${online ? "border-mesh-300 bg-mesh-50 text-mesh-800" : "border-ink/10 bg-white text-ink/50"}`}><i className={`size-2 rounded-full ${online ? "bg-mesh-500" : "bg-ink/25"}`} /> {online ? "Online for requests" : "Offline"}</div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[[Users, "Available", available, "matched to your route"], [Truck, "In motion", activeCount, "active delivery"], [CheckCircle2, "Completed", completed, "successful handovers"], [ShieldCheck, "Earned", `₹${Number(stats.totalEarned || 0).toFixed(0)}`, "courier earnings"]].map(([Icon, label, value, hint]) => <div key={label} className="rounded-2xl border border-mesh-900/10 bg-white/80 p-4 backdrop-blur"><Icon size={17} className="text-mesh-600" /><b className="mt-2 block text-2xl font-extrabold">{value}</b><span className="text-xs font-bold text-ink/60">{label}</span><small className="mt-1 block text-[10px] text-ink/35">{hint}</small></div>)}
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1240px] gap-5 px-5 py-6 sm:px-7 lg:px-10 xl:grid-cols-[300px_minmax(0,1fr)]">
        <RouteSetup form={form} setForm={setForm} locations={locations} onSubmit={saveRoute} online={online} onToggle={toggleOnline} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]">
          <div className="space-y-4"><CampusRouteMap campus={campus} route={route} position={position} pickup={pickup} destination={destination} />{route?.instructions?.[0] && <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-4 py-3 text-xs text-white"><span>{route.instructions[0]}</span><b className="shrink-0 text-mesh-200">{route.distanceMeters} m · {route.etaMinutes} min</b></div>}<ActiveTask task={active} route={route} verify={verify} setVerify={setVerify} onVerify={confirm} onAdvance={advance} onCheckpoint={checkpoint} onScan={() => setScanner(true)} /></div>
          <OffersPanel offers={offers} onAccept={accept} onDecline={decline} online={online} busyId={busyId} />
        </div>
      </div>
    </main>
  );
}
