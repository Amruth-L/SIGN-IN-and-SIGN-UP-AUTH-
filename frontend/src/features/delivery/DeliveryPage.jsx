import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Radio, Route } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { normalizeCampusLocations } from "../../lib/campus";
import { API_BASE_URL } from "../../lib/api";
import QrScanner from "../../components/QrScanner";
import ActiveTask from "./components/ActiveTask";
import CampusRouteMap from "./components/CampusRouteMap";
import OffersPanel from "./components/OffersPanel";
import RouteSetup from "./components/RouteSetup";

const API = API_BASE_URL;
const next = {
  COURIER_ASSIGNED: "GOING_TO_PICKUP",
  ACCEPTED: "GOING_TO_PICKUP",
  GOING_TO_PICKUP: "ARRIVED_AT_PICKUP",
  ARRIVING_FOR_PICKUP: "ARRIVED_AT_PICKUP",
  ORDER_COLLECTED: "GOING_TO_DESTINATION",
  PICKED_UP: "GOING_TO_DESTINATION",
  IN_TRANSIT: "ARRIVED_AT_DESTINATION",
  GOING_TO_DESTINATION: "ARRIVED_AT_DESTINATION",
};
const listFrom = (result, key) => {
  if (result.status !== "fulfilled") return [];
  const value = result.value.data;
  return Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
};
export default function DeliveryPage() {
  const { user, api } = useAuth();
  const [campus, setCampus] = useState();
  const [locations, setLocations] = useState([]);
  const [offers, setOffers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [active, setActive] = useState();
  const [route, setRoute] = useState();
  const [position, setPosition] = useState();
  const [online, setOnline] = useState(Boolean(user?.delivery_available));
  const [notice, setNotice] = useState(
    "Declare your usual route to receive matched offers.",
  );
  const [scanner, setScanner] = useState(false);
  const [verify, setVerify] = useState({
    stage: "PICKUP",
    method: "OTP",
    value: "",
  });
  const [form, setForm] = useState({
    origin_location_id: "",
    destination_location_id: "",
    available_until: new Date(Date.now() + 7200000).toISOString().slice(0, 16),
    max_detour_meters: 250,
  });
  const load = useCallback(async () => {
    const [c, l, o, m, r] = await Promise.allSettled([
      api.get("/api/campus"),
      api.get("/api/campus/locations"),
      api.get("/api/courier/offers"),
      api.get("/api/delivery/my-deliveries"),
      api.get("/api/courier/routes/current"),
    ]);
    if (c.status === "fulfilled") setCampus(c.value.data);
    const locationList = normalizeCampusLocations(l.status === "fulfilled" ? l.value.data : []);
    const offerList = listFrom(o, "offers");
    const taskList = listFrom(m, "deliveries");
    setLocations(locationList);
    setOffers(offerList);
    setTasks(taskList);
    if (r.status === "fulfilled") setOnline(Boolean(r.value.data?.route));
    setForm((current) => ({
      ...current,
      origin_location_id:
        locationList.some((item) => item.id === current.origin_location_id)
          ? current.origin_location_id
          : locationList[0]?.id || "",
      destination_location_id:
        locationList.some((item) => item.id === current.destination_location_id)
          ? current.destination_location_id
          : locationList.find((x) => x.building_id === "hostel")?.id ||
            locationList[1]?.id ||
            "",
    }));
    setActive(
      taskList.find((item) => !["COMPLETED", "DELIVERED"].includes(item.status)),
    );
    const failed = [c, l, o, m, r].find((result) => result.status === "rejected");
    if (failed) {
      setNotice(
        failed.reason?.response?.data?.error ||
          "Some courier data could not be refreshed. Try again in a moment.",
      );
    }
  }, [api]);
  useEffect(() => {
    load().catch((error) =>
      setNotice(
        error.response?.data?.error || "Could not load courier workspace.",
      ),
    );
  }, [load]);
  useEffect(() => {
    const socket = io(API, { auth: { token: localStorage.getItem("token") } });
    ["delivery:offer", "delivery:status", "delivery:assigned"].forEach(
      (event) => socket.on(event, load),
    );
    return () => socket.close();
  }, [load]);
  useEffect(() => {
    const pickupId = active?.pickup_location_id;
    const destinationId = active?.destination_location_id;
    if (!pickupId || !destinationId)
      return setRoute();
    let cancelled = false;
    api
      .get(
        `/api/campus/route?from=${encodeURIComponent(pickupId)}&to=${encodeURIComponent(destinationId)}`,
      )
      .then(({ data }) => {
        if (!cancelled) setRoute(data);
      })
      .catch(() => {
        if (!cancelled) setRoute();
      });
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.pickup_location_id, active?.destination_location_id, api]);
  const pickup = useMemo(
    () => locations.find((item) => item.id === active?.pickup_location_id),
    [locations, active],
  );
  const destination = useMemo(
    () => locations.find((item) => item.id === active?.destination_location_id),
    [locations, active],
  );
  const saveRoute = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post("/api/courier/routes", {
        ...form,
        available_until: new Date(form.available_until).toISOString(),
      });
      setOnline(true);
      setNotice(
        `Route saved: ${data.route.distanceMeters} m. Matching is live.`,
      );
      await load();
    } catch (error) {
      setNotice(error.response?.data?.error || "Could not save route.");
    }
  };
  const toggleOnline = async () => {
    try {
      if (online) {
        await api.delete("/api/courier/routes/current");
        setOnline(false);
        setNotice("You are offline.");
      } else setNotice("Save a route to go online.");
    } catch (error) {
      setNotice(error.response?.data?.error || "Could not update courier availability.");
    }
  };
  const accept = async (offer) => {
    try {
      await api.post(`/api/delivery/${offer.delivery_id}/accept`);
      setNotice("Offer accepted. Competing offers were expired atomically.");
      await load();
    } catch (error) {
      setNotice(
        error.response?.data?.error || "That offer is no longer available.",
      );
    }
  };
  const decline = async (offer) => {
    await api.post(`/api/courier/offers/${offer.delivery_id}/decline`);
    await load();
  };
  const checkpoint = async (target) => {
    try {
      const location = target === "pickup" ? pickup : destination;
      if (!location) return;
      const point = {
        x: Number(location.x),
        y: Number(location.y),
        speed: 5,
        route_node_id: location.route_node_id,
      };
      await api.post(`/api/delivery/${active.id}/location`, point);
      setPosition(point);
      setNotice("Live checkpoint shared with the owner and renter.");
    } catch (error) {
      setNotice(error.response?.data?.error || "Could not share this checkpoint.");
    }
  };
  const advance = next[active?.status]
    ? async () => {
        const status = next[active.status];
        try {
          await api.post("/api/delivery/" + active.id + "/status", { status });
          setNotice("Stage updated to " + status.replaceAll("_", " ") + ".");
          await load();
        } catch (error) {
          setNotice(error.response?.data?.error || "Could not update delivery stage.");
        }
      }
    : null;
  const confirm = async () => {
    try {
      let value = verify.value;
      if (verify.method === "QR") {
        try {
          value = JSON.parse(value);
        } catch {
          value = { token: value };
        }
      }
      await api.post(`/api/delivery/${active.id}/verify-handover`, {
        ...verify,
        value,
      });
      setNotice(`${verify.stage.replaceAll("_", " ")} verified and recorded.`);
      const followingStage = {
        PICKUP: "DELIVERY",
        XEROX_PICKUP: "DELIVERY",
        RETURN_PICKUP: "RETURN_RECEIVED",
      }[verify.stage];
      setVerify((current) => ({
        ...current,
        stage: followingStage || current.stage,
        value: "",
      }));
      await load();
    } catch (error) {
      setNotice(
        error.response?.data?.error || "Credential verification failed.",
      );
    }
  };
  return (
    <main className="min-h-screen bg-paper pb-16">
      {scanner && (
        <QrScanner
          onClose={() => setScanner(false)}
          onResult={(value) => {
            setVerify((current) => ({ ...current, method: "QR", value }));
            setScanner(false);
          }}
        />
      )}
      <header className="border-b border-ink/10 bg-[radial-gradient(circle_at_75%_0%,rgba(61,121,255,.12),transparent_28%)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 flex items-center gap-1">
                <Radio size={13} /> Courier workspace
              </span>
              <h1 className="mt-3 font-display text-5xl font-semibold">
                Deliver on your route.
              </h1>
              <p className="mt-3 text-sm text-ink/50">{notice}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mesh-900/10 bg-white/80 px-3 py-1 text-xs font-bold text-mesh-700 w-fit">
              <Route size={14} />
              {tasks.filter((item) => item.status === "COMPLETED").length}{" "}
              completed
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 grid gap-5 py-6 xl:grid-cols-[300px_1fr_360px]">
        <div className="space-y-5">
          <RouteSetup
            form={form}
            setForm={setForm}
            locations={locations}
            onSubmit={saveRoute}
            online={online}
            onToggle={toggleOnline}
          />
          <OffersPanel
            offers={offers}
            onAccept={accept}
            onDecline={decline}
            online={online}
          />
        </div>
        <div>
          <CampusRouteMap
            campus={campus}
            route={route}
            position={position}
            pickup={pickup}
            destination={destination}
          />
          {route && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-sm text-white">
              <span>{route.instructions?.[0]}</span>
              <b>
                {route.distanceMeters} m · {route.etaMinutes} min
              </b>
            </div>
          )}
        </div>
        <ActiveTask
          task={active}
          route={route}
          verify={verify}
          setVerify={setVerify}
          onVerify={confirm}
          onAdvance={advance}
          onCheckpoint={checkpoint}
          onScan={() => setScanner(true)}
        />
      </div>
    </main>
  );
}
