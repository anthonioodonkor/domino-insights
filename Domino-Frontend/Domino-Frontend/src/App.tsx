import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  FlaskConical,
  LayoutDashboard,
  Radio,
  RotateCcw,
  ShieldCheck,
  WifiOff,
  Zap,
} from "lucide-react";
import { useDomino } from "./lib/connection";
import { Overview, type Navigate } from "./pages/Overview";
import { BuildingDetail } from "./pages/BuildingDetail";
import { IncidentDetail } from "./pages/IncidentDetail";
import {
  ActionButton,
  Button,
  CommandFeedback,
  useCommand,
} from "./components/ui";

type Route = { type: "overview" | "building" | "incident"; id: string };
function readRoute(): Route {
  const [type, ...parts] = window.location.hash.replace(/^#\/?/, "").split("/");
  let id = "";
  try {
    id = decodeURIComponent(parts.join("/"));
  } catch {
    /* Invalid deep links return to overview. */
  }
  return type === "building" || type === "incident"
    ? { type, id }
    : { type: "overview", id: "" };
}

export default function App() {
  const state = useDomino();
  const [route, setRoute] = useState<Route>(readRoute);
  const [displayName, setDisplayName] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const register = useCommand();
  useEffect(() => {
    const update = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const navigate: Navigate = (type, id = "") => {
    window.location.hash =
      type === "overview" ? "/" : `/${type}/${encodeURIComponent(id)}`;
  };
  const connected = state.connectionStatus === "live" || state.connectionStatus === "preview";
  const manager = state.member?.role === "manager";
  const active = state.portfolio.incidents.filter(
    (i) => i.status !== "resolved",
  );
  const copyIdentity = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(state.identity);
      setCopied(true);
    } catch {
      setCopyError(
        "Clipboard unavailable. Select and copy the identity below.",
      );
    }
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Domino home"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          domino<span className="brand-period">.</span>
        </button>
        <div className="workspace-label">BUILDING INTELLIGENCE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${route.type === "overview" ? "active" : ""}`}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={18} />
            Portfolio overview
            <ChevronRight size={15} />
          </button>
          <div className="nav-group-title">
            BUILDINGS <span>{state.portfolio.buildings.length}</span>
          </div>
          {state.portfolio.buildings.map((b) => (
            <button
              key={b.id}
              className={`nav-item nav-building ${route.type === "building" && route.id === b.id ? "active" : ""}`}
              onClick={() => navigate("building", b.id)}
            >
              <Building2 size={17} />
              <span>{b.name}</span>
            </button>
          ))}
          <div className="nav-group-title">
            ACTIVE INCIDENTS <span>{active.length}</span>
          </div>
          {active.length ? (
            active.map((i) => (
              <button
                key={i.id}
                className={`nav-item nav-incident ${route.type === "incident" && route.id === i.id ? "active" : ""}`}
                onClick={() => navigate("incident", i.id)}
              >
                <span className={`incident-nav-dot dot-${i.severity}`} />
                <span>
                  {state.portfolio.assets.find((a) => a.id === i.assetId)
                    ?.name ?? i.assetId}
                </span>
                <span className="nav-score">{i.riskScore}</span>
              </button>
            ))
          ) : (
            <span className="sidebar-empty">No active incidents</span>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-demo">
            <FlaskConical size={18} />
            <div>
              <strong>Synthetic demo</strong>
              <span>
                Built for possibility.
                <br />
                Frontend preview.
              </span>
            </div>
          </div>
          <div className="member-card">
            <span className="avatar">
              {(state.member?.displayName ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{state.member?.displayName ?? "New operator"}</strong>
              <span>
                {state.member?.role === "manager"
                  ? "Facilities manager"
                  : state.member
                    ? "Building engineer"
                    : "Registration required"}
              </span>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {route.type === "overview"
                ? "Portfolio overview"
                : route.type === "building"
                  ? "Building detail"
                  : "Incident detail"}
            </strong>
          </div>
          <div className="topbar-right">
            <div
              className={`connection-state connection-${state.connectionStatus}`}
            >
              <span className="status-dot" />
              {connected
                ? state.connectionStatus === "preview" ? "Local preview" : "Live sync"
                : state.connectionStatus === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </div>
            <span className="topbar-divider" />
            <span className="topbar-demo">HackUTD 2026</span>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {state.connectionStatus === "preview" && <div className="preview-notice" role="status">Local frontend preview. Sample data and actions stay in this tab; reloading resets them. No backend is connected.</div>}
          {!connected && (
            <div
              className={`connection-banner ${state.connectionStatus === "connecting" ? "connecting-banner" : ""}`}
              role="status"
            >
              {state.connectionStatus === "connecting" ? (
                <Radio size={19} className="pulse" />
              ) : (
                <WifiOff size={19} />
              )}
              <div>
                <strong>
                  {state.connectionStatus === "connecting"
                    ? "Connecting to the shared workspace…"
                    : "Live connection interrupted"}
                </strong>
                <p>
                  {state.connectionError ??
                    (state.connectionStatus === "connecting"
                      ? "Waiting for the initial data connection."
                      : "Displayed data may be stale. Shared actions are unavailable until reconnected.")}
                </p>
              </div>
              {state.connectionStatus !== "connecting" && (
                <Button variant="secondary" onClick={state.reconnect}>
                  <RotateCcw size={14} />
                  Reconnect
                </Button>
              )}
            </div>
          )}
          {connected && !state.member && (
            <section className="registration-panel">
              <div>
                <span className="registration-icon">
                  <ShieldCheck size={23} />
                </span>
                <h2>Join the operations workspace</h2>
                <p>
                  Register your name to participate as a building engineer. A
                  workspace administrator provisions manager access separately.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void register.run(
                      () => state.actions.register(displayName),
                      "Registration submitted.",
                    );
                  }}
                >
                  <label className="field">
                    Display name
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={register.pending}
                    />
                  </label>
                  <Button type="submit" disabled={register.pending}>
                    {register.pending ? "Registering…" : "Register as engineer"}
                    <ArrowUpRight size={15} />
                  </Button>
                </form>
                <CommandFeedback
                  error={register.error}
                  success={register.success}
                />
              </div>
              <div className="identity-instructions">
                <h3>Your connection identity</h3>
                <p>
                  Share this identity with the workspace administrator for role
                  provisioning. Roles are enforced by the backend.
                </p>
                <code>{state.identity || "Waiting for identity…"}</code>
                <Button
                  variant="secondary"
                  disabled={!state.identity}
                  onClick={() => void copyIdentity()}
                >
                  <Copy size={14} />
                  {copied ? "Identity copied" : "Copy identity"}
                </Button>
                {copyError && <p role="alert">{copyError}</p>}
              </div>
            </section>
          )}
          {manager && (
            <div className="demo-toolbar">
              <div>
                <FlaskConical size={15} />
                <span>Demo controls</span>
                <span className="muted">Manager access</span>
              </div>
              <div className="demo-toolbar-actions">
                <ActionButton
                  variant="secondary"
                  action={state.actions.injectScenario}
                  disabled={!connected || !state.portfolio.buildings.length}
                >
                  <Zap size={14} />
                  Inject chiller scenario
                </ActionButton>
                <details className="demo-menu">
                  <summary>
                    Manage demo
                    <ChevronDown size={13} />
                  </summary>
                  <div className="demo-popover">
                    <p>Preview changes stay in this tab and reset on reload.</p>
                    <ActionButton
                      variant="secondary"
                      action={state.actions.seedDemo}
                      disabled={
                        !connected || state.portfolio.buildings.length > 0
                      }
                    >
                      Seed empty portfolio
                    </ActionButton>
                    {!confirmReset ? (
                      <Button
                        variant="ghost"
                        disabled={!connected}
                        onClick={() => setConfirmReset(true)}
                      >
                        <RotateCcw size={14} />
                        Reset demo…
                      </Button>
                    ) : (
                      <>
                        <p className="reset-warning">
                          Reset removes incident, proposal, and event history
                          and restores the synthetic portfolio.
                        </p>
                        <ActionButton
                          variant="danger"
                          action={async () => {
                            await state.actions.resetDemo();
                            setConfirmReset(false);
                            navigate("overview");
                          }}
                          disabled={!connected}
                        >
                          Confirm reset
                        </ActionButton>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmReset(false)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}
          {route.type === "overview" ? (
            <Overview state={state} navigate={navigate} />
          ) : route.type === "building" ? (
            <BuildingDetail
              key={route.id}
              state={state}
              id={route.id}
              navigate={navigate}
            />
          ) : (
            <IncidentDetail
              key={route.id}
              state={state}
              id={route.id}
              navigate={navigate}
            />
          )}
          <footer className="page-footer">
            <span>
              <Activity size={13} />
              Domino · Building operations, connected.
            </span>
            <span>
              Synthetic data · Estimated financial impact · Human-reviewed
              responses
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
