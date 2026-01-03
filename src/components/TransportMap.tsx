import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylinedecorator";
import "./node-label.css";
import "./live-marker.css";
import Legend from "./Legends";

interface GraphNode {
  lat: number;
  lon: number;
  name: string;
}

interface GraphEdge {
  from: string;
  to: string;
  distance_km?: number;
  connection?: string;
  speed_kmh?: number;
  daily_capacity?: number;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Event {
  position: [number, number];
}

interface Props {
  graph: Graph;
  events: Event[];
  edgeUsage?: Record<string, number>;
  mainRouteUsage?: Record<string, number>;
  altRouteUsage?: Record<string, number>;
  onBottlenecksChanged?: (
    list: { from: string; to: string; load: number }[]
  ) => void;
  centralityData?: Record<string, any>;
  centralityMode?: string;
  topBottlenecks?: { from: string; to: string; load: number }[];
}

export default function TransportMap({
  graph,
  events,
  edgeUsage,
  mainRouteUsage,
  altRouteUsage,
  onBottlenecksChanged,
  centralityData,
  centralityMode,
  topBottlenecks,
}: Props) {
  // === Capacity calculator (hoisted so it is available everywhere) ===
  function computeCapacityClass(edge: GraphEdge, n1: GraphNode, n2: GraphNode) {
    const R = 6371;
    const toRad = (v: number) => (v * Math.PI) / 180;

    const dLat = toRad(n2.lat - n1.lat);
    const dLon = toRad(n2.lon - n1.lon);
    const lat1 = toRad(n1.lat);
    const lat2 = toRad(n2.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    const dist = 2 * R * Math.asin(Math.sqrt(h));

    // Base capacity by distance
    let base = dist > 600 ? 8000 : dist > 200 ? 4000 : 1500;

    // Factor by infrastructure type
    let factor = 1.0;
    if (edge.connection === "rail") factor = 1.5;
    if (edge.connection === "highway") factor = 1.3;
    if (edge.connection === "road") factor = 1.0;
    if (edge.connection === "port") factor = 2.0;
    if (edge.connection === "air") factor = 3.0;

    return Math.round(base * factor);
  }
  const mapRef = useRef<L.Map | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);
  const livePathRef = useRef<L.Polyline | null>(null);

  const labelLayer = useRef<L.LayerGroup | null>(null);
  const edgeLayer = useRef<L.LayerGroup | null>(null);

  // Animierte Transport-Punkte (Moving Dots)
  const animatedMarkersRef = useRef<
    {
      marker: L.CircleMarker;
      from: [number, number];
      to: [number, number];
      t: number; // Position 0..1 entlang der Kante
      speed: number; // Geschwindigkeit (Anteil pro Sekunde)
    }[]
  >([]);
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const [hoverInfo, setHoverInfo] = useState<any | null>(null);
  const [disabledEdges, setDisabledEdges] = useState<Set<string>>(new Set());

  // -------------------------------
  // Farbskala für Kanten
  // -------------------------------
  function edgeColorByDistance(n1: GraphNode, n2: GraphNode): string {
    const toRad = (x: number) => (x * Math.PI) / 180;

    const d =
      Math.acos(
        Math.sin(toRad(n1.lat)) * Math.sin(toRad(n2.lat)) +
          Math.cos(toRad(n1.lat)) *
            Math.cos(toRad(n2.lat)) *
            Math.cos(toRad(n2.lon - n1.lon))
      ) * 6371;

    if (d < 200) return "rgba(0,255,0,0.6)";
    if (d < 800) return "rgba(255,180,0,0.7)";
    return "rgba(255,0,0,0.75)";
  }

  // -------------------------------
  // 1) Karte EINMAL erstellen
  // -------------------------------
  useEffect(() => {
    if (mapRef.current) return; // schon initialisiert

    const map = L.map("transportMap").setView([51, 10], 5);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    labelLayer.current = L.layerGroup().addTo(map);
    edgeLayer.current = L.layerGroup().addTo(map);

    livePathRef.current = L.polyline([], {
      color: "cyan",
      weight: 4,
    }).addTo(map);
  }, []);

  // -------------------------------
  // 2) Graph (Nodes + Edges) zeichnen
  // -------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    if (!edgeLayer.current) return;

    // Prevent crash when graph is not loaded yet
    if (!graph || !graph.nodes || !graph.edges) return;

    // Layer leeren
    edgeLayer.current.clearLayers();

    // Alte animierte Marker entfernen
    if (mapRef.current) {
      animatedMarkersRef.current.forEach((a) => {
        mapRef.current!.removeLayer(a.marker);
      });
    }
    animatedMarkersRef.current = [];

    // ===============================
    // Node Farb- & Icon-System
    // ===============================
    function getNodeColor(modes: string[] = []): string {
      if (modes.includes("port")) return "#4DA3FF"; // blau
      if (modes.includes("airport")) return "#FF8C42"; // orange
      if (modes.includes("rail") || modes.includes("infrastructure"))
        return "#4CAF50"; // grün
      return "#FFD84D"; // city/generic
    }

    function getNodeBorder(modes: string[] = []): string {
      if (modes.includes("airport")) return "#CC5500"; // dunkler Rand
      if (modes.includes("port")) return "#003F7F"; // navy
      if (modes.includes("rail") || modes.includes("infrastructure"))
        return "#1E7A3B"; // dark green
      return "#B89600"; // city
    }

    // ===============================
    // ----------------------------------------
    // TOP-5 CENTRALITY NODES
    // ----------------------------------------
    let top5Nodes: string[] = [];

    if (centralityMode && centralityMode !== "none" && centralityData) {
      const sorted = Object.entries(centralityData)
        .sort(
          (a, b) => (b[1][centralityMode] ?? 0) - (a[1][centralityMode] ?? 0)
        )
        .slice(0, 5);

      top5Nodes = sorted.map(([name]) => name);
    }
    // ===============================
    // NODES ZEICHNEN
    // ===============================
    graph.nodes.forEach((n: any) => {
      let fillColor = getNodeColor(n.modes);
      const borderColor = getNodeBorder(n.modes);

      // === CENTRALITY: node radius + heat-color ===
      let radius = 8;

      if (
        centralityMode &&
        centralityMode !== "none" &&
        centralityData &&
        centralityData[n.name]
      ) {
        const c = centralityData[n.name][centralityMode] ?? 0;

        // Radius scaling for betweenness/closeness/degree
        radius = 6 + c * 40;

        // Color override for closeness heatmap
        if (centralityMode === "closeness") {
          const intensity = Math.floor(255 * c);
          fillColor = `rgb(${intensity}, 80, 0)`;
        }

        // Color override for betweenness (stronger red tone)
        if (centralityMode === "betweenness") {
          const red = Math.floor(80 + c * 400);
          fillColor = `rgb(${red}, 40, 40)`;
        }
      }

      const marker = L.circleMarker([n.lat, n.lon], {
        radius,
        fillColor,
        color: borderColor,
        weight: 2,
        fillOpacity: 0.95,
      });

      marker.on("click", () => {});

      marker.on("mouseover", () => {
        setHoverInfo({
          type: "node",
          node: n,
          outgoing: graph.edges.filter((e) => e.from === n.name).length,
          incoming: graph.edges.filter((e) => e.to === n.name).length,
        });
      });
      marker.on("mouseout", () => setHoverInfo(null));

      let centralityHtml = "";
      if (centralityData && centralityData[n.name]) {
        const c = centralityData[n.name];
        centralityHtml = `
    <br><b>Zentralität:</b><br>
    Degree: ${c.degree?.toFixed(3)}<br>
    Closeness: ${c.closeness?.toFixed(3)}<br>
    Betweenness: ${c.betweenness?.toFixed(3)}
  `;
      }

      const tooltipHtml = `
        <b>${n.name}</b><br>
        <i>Typ:</i> ${n.modes?.join(", ") || "Unbekannt"}<br>
        <i>Position:</i> ${n.lat.toFixed(2)}, ${n.lon.toFixed(2)}
        ${centralityHtml}
      `;

      marker.bindTooltip(tooltipHtml, { direction: "top" });
      marker.addTo(edgeLayer.current!);
    });

    // Helper to compute haversine distance (old, unused)
    function computeDistance(a: GraphNode, b: GraphNode) {
      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLon = ((b.lon - a.lon) * Math.PI) / 180;
      const lat1 = (a.lat * Math.PI) / 180;
      const lat2 = (b.lat * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    }

    // ====== CAPACITY LOGIC (D3) ======
    function computeDistanceMap(n1: GraphNode, n2: GraphNode) {
      const R = 6371;
      const dLat = ((n2.lat - n1.lat) * Math.PI) / 180;
      const dLon = ((n2.lon - n1.lon) * Math.PI) / 180;
      const lat1 = (n1.lat * Math.PI) / 180;
      const lat2 = (n2.lat * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    }

    // ---- Bottleneck collection array ----
    const bottleneckList: { from: string; to: string; load: number }[] = [];

    // Edges
    graph.edges.forEach((e) => {
      const isTop5 = topBottlenecks?.some(
        (b) => b.from === e.from && b.to === e.to
      );
      const n1 = graph.nodes.find((n) => n.name === e.from);
      const n2 = graph.nodes.find((n) => n.name === e.to);
      if (!n1 || !n2) {
        console.warn("Edge refers to unknown nodes:", e);
        return;
      }

      const key = `${e.from}→${e.to}`;
      const isDisabled = disabledEdges.has(key);
      const used = (mainRouteUsage?.[key] ?? 0) + (altRouteUsage?.[key] ?? 0);
      const usedMain = mainRouteUsage?.[key] ?? 0;
      const usedAlt = altRouteUsage?.[key] ?? 0;

      // --- CAPACITY LOGIC (D3) ---
      const capacity = computeCapacityClass(e, n1, n2);
      const load = used;
      const loadFactor = load / capacity;

      // Collect for top bottlenecks list
      if (loadFactor > 0) {
        bottleneckList.push({
          from: e.from,
          to: e.to,
          load: loadFactor,
        });
      }

      if (!usedMain && !usedAlt && loadFactor < 1) return;

      // Styling für Routen
      let color = "blue";
      let weight = 4;
      let dashArray: string | null = null;

      if (isDisabled) {
        color = "#555";
        weight = 3;
        dashArray = "4,6";
      } else {
        if (usedAlt > 0 && usedMain === 0) {
          color = "green"; // Route B
          dashArray = "6, 8"; // gestrichelt
        }
        if (usedMain > 0 && usedAlt > 0) {
          color = "purple"; // Mischfall
          dashArray = "4, 6";
        }

        // ---- ENGAPSS-OVERRIDE: unabhängig von Route-Farbe ----
        if (loadFactor >= 1) {
          color = "#ff2b2b"; // satteres Rot
          weight = 8; // dickere Linie
          dashArray = null; // immer durchgezogen
        }
      }

      // Heatmap bleibt als Overlay möglich: wenn du willst, color durch heatmap ersetzen.
      // Aber vorerst: Route-Farben priorisieren.

      const line = L.polyline(
        [
          [n1.lat, n1.lon],
          [n2.lat, n2.lon],
        ],
        {
          color,
          weight,
          opacity: isDisabled ? 0.5 : 0.9,
          dashArray: dashArray ?? undefined,
        }
      );

      line.on("click", () => {
        setDisabledEdges(prev => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });
      });

      line.on("mouseover", () => {
        setHoverInfo({
          type: "edge",
          edge: e,
          n1,
          n2,
        });
      });
      line.on("mouseout", () => setHoverInfo(null));

      const dist = e.distance_km ?? computeDistance(n1, n2).toFixed(0);
      const connection = e.connection ?? "Straße";
      const speed = e.speed_kmh ?? 80;
      // const capDisplay = e.daily_capacity ?? 120;
      const tooltipHtml = `
        <b>${e.from} → ${e.to}</b><br>
        <i>Verbindung:</i> ${connection}<br>
        <i>Distanz:</i> ${dist} km<br>
        <i>Geschwindigkeit:</i> ${speed} km/h<br>
        <i>Tägliche Kapazität:</i> ${computeCapacityClass(e, n1, n2)}<br>
        ${
          isDisabled
            ? `<span style="color:red"><b>❌ Ausgefallen</b></span>`
            : `<span style="color:green">✔ Aktiv</span>`
        }
      `;

      line.bindTooltip(tooltipHtml);

      line.on("mouseover", () => line.setStyle({ weight: 6, opacity: 1 }));
      line.on("mouseout", () => line.setStyle({ weight: 3, opacity: 0.8 }));

      line.addTo(edgeLayer.current!);

      // ---- Engpass-Label direkt auf der Linie (A1) ----
      if (loadFactor >= 1) {
        // Mittelpunkt der Kante berechnen
        const midLat = (n1.lat + n2.lat) / 2;
        const midLon = (n1.lon + n2.lon) / 2;

        const labelIcon = L.divIcon({
          className: "",
          html: `
            <div style="
              padding: 3px 6px;
              background: rgba(255,255,255,0.9);
              border: 1px solid #ff2b2b;
              border-radius: 4px;
              font-size: 12px;
              color: #b40000;
              font-weight: bold;
            ">
              ${Math.round(loadFactor * 100)}%
            </div>
          `,
        });

        L.marker([midLat, midLon], { icon: labelIcon }).addTo(
          edgeLayer.current!
        );
      }

      // Pfeil-Dekorator
      // @ts-ignore – Plugin ist zur Laufzeit vorhanden
      const decorator = (L as any).polylineDecorator(line, {
        patterns: [
          {
            offset: "50%",
            repeat: 0,
            symbol: (L as any).Symbol.arrowHead({
              pixelSize: 12,
              polygon: false,
              pathOptions: { color, weight: 2 },
            }),
          },
        ],
      });
      decorator.addTo(edgeLayer.current!);

      // Moving-Dot Marker für diese genutzte Kante anlegen
      if (isDisabled) return;
      if (mapRef.current) {
        const animatedMarker = L.circleMarker([n1.lat, n1.lon], {
          radius: 5,
          color,
          fillColor: color,
          fillOpacity: 1,
          opacity: 1,
        }).addTo(mapRef.current);

        const speed = 0.2 + 0.6 * Math.min(1, used / capacity); // stärker genutzte Kanten bewegen sich schneller

        animatedMarkersRef.current.push({
          marker: animatedMarker,
          from: [n1.lat, n1.lon],
          to: [n2.lat, n2.lon],
          t: Math.random(), // zufälliger Startpunkt auf der Kante
          speed,
        });
      }
    });

    // ---- Send Top 3 Bottlenecks to App.tsx ----
    if (onBottlenecksChanged) {
      const top3 = bottleneckList.sort((a, b) => b.load - a.load).slice(0, 3);
      onBottlenecksChanged(top3);
    }

    // AUTO-ZOOM AUF GENUTZTE ROUTE
    const routeCoords: [number, number][] = [];

    graph.edges.forEach((e) => {
      const key = `${e.from}→${e.to}`;
      if ((mainRouteUsage?.[key] ?? 0) > 0 || (altRouteUsage?.[key] ?? 0) > 0) {
        const n1 = graph.nodes.find((n) => n.name === e.from);
        const n2 = graph.nodes.find((n) => n.name === e.to);
        if (n1 && n2) {
          routeCoords.push([n1.lat, n1.lon]);
          routeCoords.push([n2.lat, n2.lon]);
        }
      }
    });

    if (routeCoords.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(routeCoords);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [graph, edgeUsage, mainRouteUsage, altRouteUsage, disabledEdges]);

  // -------------------------------
  // 3) Labels (Städtenamen) bei Zoom
  // -------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const updateLabels = () => {
      if (!labelLayer.current) return;

      const zoom = map.getZoom();
      labelLayer.current.clearLayers();

      // Nur ab Zoomstufe 7 Labels anzeigen
      if (zoom < 7) return;

      graph.nodes.forEach((n) => {
        L.marker([n.lat, n.lon], {
          icon: L.divIcon({
            className: "node-label",
            html: `<div>${n.name}</div>`,
          }),
        }).addTo(labelLayer.current!);
      });
    };

    map.on("zoomend", updateLabels);
    updateLabels(); // einmal initial

    return () => {
      map.off("zoomend", updateLabels);
    };
  }, [graph]);

  // -------------------------------
  // 4) Live-Tracking der Simulation
  // -------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    if (!livePathRef.current) return;
    if (events.length === 0) return;

    const last = events[events.length - 1];

    livePathRef.current.addLatLng(last.position);

    if (!liveMarkerRef.current) {
      liveMarkerRef.current = L.marker(last.position, {
        icon: L.divIcon({
          className: "live-marker",
          html: `<div class="pulse"></div>`,
        }),
      }).addTo(mapRef.current);
    } else {
      liveMarkerRef.current.setLatLng(last.position);
    }
  }, [events]);

  // -------------------------------
  // 5) Animationsschleife für Moving Dots
  // -------------------------------
  useEffect(() => {
    if (!mapRef.current) return;

    const step = (timestamp: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp;
      }
      const dt = (timestamp - lastTimeRef.current) / 1000; // Sekunden
      lastTimeRef.current = timestamp;

      if (animatedMarkersRef.current.length > 0) {
        animatedMarkersRef.current.forEach((a) => {
          a.t += a.speed * dt;
          if (a.t > 1) a.t -= 1;

          const lat = a.from[0] + (a.to[0] - a.from[0]) * a.t;
          const lon = a.from[1] + (a.to[1] - a.from[1]) * a.t;
          a.marker.setLatLng([lat, lon]);
        });
      }

      animationFrameId.current = requestAnimationFrame(step);
    };

    animationFrameId.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameId.current != null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      lastTimeRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        id="transportMap"
        style={{
          height: "100vh",
          width: "100%",
          margin: 0,
          padding: 0,
          position: "relative",
          zIndex: 1,
        }}
      />
      <Legend />
      {hoverInfo && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            width: "260px",
            padding: "15px",
            background: "rgba(20,20,20,0.9)",
            color: "white",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 0 12px rgba(0,0,0,0.35)",
            zIndex: 99999,
          }}
        >
          {hoverInfo.type === "node" && (
            <div>
              <b>{hoverInfo.node.name}</b>
              <br />
              Typ: {hoverInfo.node.modes?.join(", ") || "Unbekannt"}
              <br />
              Position: {hoverInfo.node.lat.toFixed(2)},{" "}
              {hoverInfo.node.lon.toFixed(2)}
              <br />
              Ausgehend: {hoverInfo.outgoing}
              <br />
              Eingehend: {hoverInfo.incoming}
            </div>
          )}
          {hoverInfo.type === "edge" && (
            <div>
              <b>
                {hoverInfo.edge.from} → {hoverInfo.edge.to}
              </b>
              <br />
              Verbindung: {hoverInfo.edge.connection}
              <br />
              Distanz: {hoverInfo.edge.distance_km} km
              <br />
              Speed: {hoverInfo.edge.speed_kmh} km/h
              <br />
              Kapazität:{" "}
              {hoverInfo.n1 && hoverInfo.n2
                ? computeCapacityClass(
                    hoverInfo.edge,
                    hoverInfo.n1,
                    hoverInfo.n2
                  )
                : hoverInfo.edge.daily_capacity ?? "?"}
              /Tag
            </div>
          )}
        </div>
      )}
    </>
  );
}
