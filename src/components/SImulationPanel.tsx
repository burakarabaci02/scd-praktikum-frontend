import { useState } from "react";

interface SimulationPanelProps {
  onRunSimulation?: (settings: {
    shipments: { from: string; to: string; quantity: number }[];
    mainRouteShare: number;
  }) => void;
  onRunGlobalSimulation?: () => void;
  frozenRouteA?: string[];
  frozenRouteB?: string[];
  kpiInput: any;
  topBottlenecks?: { from: string; to: string; load: number }[];
  centralityMode?: string;
  onCentralityModeChange?: (mode: string) => void;
  kpis?: Record<string, any> | null;
}

export default function SimulationPanel({
  onRunSimulation,
  onRunGlobalSimulation,
  frozenRouteA,
  frozenRouteB,
  topBottlenecks,
  centralityMode,
  onCentralityModeChange,
  kpis,
}: SimulationPanelProps) {
  const [shipments, setShipments] = useState([
    { from: "Hamburg", to: "Rom", quantity: 300 },
  ]);
  const [mainRouteShare, setMainRouteShare] = useState(80);

  function addShipment() {
    setShipments((prev) => [
      ...prev,
      { from: "Hamburg", to: "Rom", quantity: 100 },
    ]);
  }

  function removeShipment(index: number) {
    setShipments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateShipment(index: number, field: string, value: any) {
    setShipments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function Accordion({ title, children, defaultOpen = true }: any) {
    const [open, setOpen] = useState(defaultOpen);

    return (
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: "6px",
          marginBottom: "20px",
          border: "1px solid #444",
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
            fontSize: "15px",
          }}
        >
          {title}
          <span>{open ? "▲" : "▼"}</span>
        </div>

        {open && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "10px 12px" }}
          >
            {children}
          </div>
        )}
      </div>
    );
  }

  const nodeOptions = [
    "Hamburg",
    "Berlin",
    "München",
    "Köln",
    "Rom",
    "Paris",
    "Mailand",
    "Stockholm",
    "Helsinki",
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "300px",
        height: "100vh",
        background: "rgba(20,20,20,0.92)",
        color: "#eee",
        padding: "20px",
        boxShadow: "4px 0 20px rgba(0,0,0,0.45)",
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "20px" }}>Transport Simulation</h2>

      <Accordion title="Transporte">
        {shipments.map((s, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "15px",
              borderBottom: "1px solid #555",
              paddingBottom: "10px",
            }}
          >
            <label>Start</label>
            <select
              value={s.from}
              onChange={(e) => updateShipment(idx, "from", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                marginBottom: "6px",
                background: "#111",
                color: "#eee",
              }}
            >
              {nodeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label>Ziel</label>
            <select
              value={s.to}
              onChange={(e) => updateShipment(idx, "to", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                marginBottom: "6px",
                background: "#111",
                color: "#eee",
              }}
            >
              {nodeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label>Menge: {s.quantity}</label>
            <input
              type="range"
              min={10}
              max={2000}
              value={s.quantity}
              onChange={(e) =>
                updateShipment(idx, "quantity", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />

            <button
              style={{
                marginTop: "8px",
                background: "#b91c1c",
                padding: "6px",
                width: "100%",
                borderRadius: "4px",
                border: "none",
                color: "white",
                cursor: "pointer",
              }}
              onClick={() => removeShipment(idx)}
            >
              Entfernen
            </button>
          </div>
        ))}

        <button
          onClick={addShipment}
          style={{
            padding: "8px",
            background: "#16a34a",
            border: "none",
            borderRadius: "6px",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            width: "100%",
            marginTop: "10px",
          }}
        >
          + Transport hinzufügen
        </button>
      </Accordion>

      <div>
        <label style={{ fontSize: "14px" }}>
          Hauptroute-Anteil: {mainRouteShare}%
        </label>
        <div style={{ fontSize: "13px", marginTop: "4px", opacity: 0.85 }}>
          Hauptroute:{" "}
          {Math.round(
            (shipments.reduce((acc, s) => acc + s.quantity, 0) *
              mainRouteShare) /
              100
          )}{" "}
          Transporte
          <br />
          Alternativroute:{" "}
          {Math.round(
            (shipments.reduce((acc, s) => acc + s.quantity, 0) *
              (100 - mainRouteShare)) /
              100
          )}{" "}
          Transporte
        </div>
        <input
          type="range"
          min={50}
          max={100}
          value={mainRouteShare}
          onChange={(e) => setMainRouteShare(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <button
        onClick={() =>
          onRunSimulation &&
          onRunSimulation({
            shipments,
            mainRouteShare: mainRouteShare / 100,
          })
        }
        style={{
          padding: "12px",
          background: "#3b82f6",
          border: "none",
          borderRadius: "6px",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Simulation starten
      </button>

      <button
        onClick={() => onRunGlobalSimulation && onRunGlobalSimulation()}
        style={{
          marginTop: "12px",
          padding: "12px",
          background: "#8b5cf6",
          border: "none",
          borderRadius: "6px",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🌐 Globale Netzsimulation
      </button>

      {frozenRouteA && frozenRouteA.length > 0 && (
        <Accordion title="Route Summary">
          <div style={{ fontSize: "13px", marginBottom: "12px" }}>
            <strong>Hauptroute (A):</strong>
            <br />
            {frozenRouteA.join(" → ")}
            <br />
            Kanten: {frozenRouteA.length - 1}
          </div>

          {frozenRouteB && frozenRouteB.length > 0 && (
            <div style={{ fontSize: "13px" }}>
              <strong>Alternativroute (B):</strong>
              <br />
              {frozenRouteB.join(" → ")}
              <br />
              Kanten: {frozenRouteB.length - 1}
            </div>
          )}
        </Accordion>
      )}

      {topBottlenecks && topBottlenecks.length > 0 && (
        <Accordion title="Top 3 Engpässe">
          <table
            style={{
              width: "100%",
              fontSize: "13px",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    paddingBottom: "6px",
                    borderBottom: "1px solid #555",
                  }}
                >
                  Kante
                </th>
                <th
                  style={{
                    textAlign: "right",
                    paddingBottom: "6px",
                    borderBottom: "1px solid #555",
                  }}
                >
                  Load
                </th>
              </tr>
            </thead>
            <tbody>
              {topBottlenecks.slice(0, 3).map((b, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "6px 0" }}>
                    {b.from} → {b.to}
                  </td>
                  <td style={{ textAlign: "right", padding: "6px 0" }}>
                    {Math.round(b.load * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Accordion>
      )}

      <Accordion title="Zentralitätsanalyse">
        <div
          style={{
            fontSize: "13px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <label>
            <input
              type="radio"
              checked={centralityMode === "none"}
              onChange={() =>
                onCentralityModeChange && onCentralityModeChange("none")
              }
            />{" "}
            Keine
          </label>

          <label>
            <input
              type="radio"
              checked={centralityMode === "betweenness"}
              onChange={() =>
                onCentralityModeChange && onCentralityModeChange("betweenness")
              }
            />{" "}
            Betweenness Centrality
          </label>

          <label>
            <input
              type="radio"
              checked={centralityMode === "closeness"}
              onChange={() =>
                onCentralityModeChange && onCentralityModeChange("closeness")
              }
            />{" "}
            Closeness Centrality
          </label>

          <label>
            <input
              type="radio"
              checked={centralityMode === "degree"}
              onChange={() =>
                onCentralityModeChange && onCentralityModeChange("degree")
              }
            />{" "}
            Degree Centrality
          </label>
        </div>
      </Accordion>
      {kpis && (
        <Accordion title="KPIs">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {Object.entries(kpis).map(([key, value]) => (
              <div
                key={key}
                style={{
                  background: "#1b1b1b",
                  padding: "14px",
                  borderRadius: "8px",
                  boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: "26px", fontWeight: "bold" }}>
                  {value.icon ? value.icon + " " : ""}
                  {value.value}
                </div>
                <div style={{ opacity: 0.7, marginTop: "4px" }}>
                  {value.label}
                </div>
              </div>
            ))}
          </div>
        </Accordion>
      )}
    </div>
  );
}
