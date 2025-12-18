import type { Graph, GraphNode, GraphEdge } from "./types/Graph.ts";

function computeDistance(n1: GraphNode, n2: GraphNode) {
  const R = 6371; // km
  const dLat = ((n2.lat - n1.lat) * Math.PI) / 180;
  const dLon = ((n2.lon - n1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(n1.lat * Math.PI / 180) *
      Math.cos(n2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeCapacityClass(edge: GraphEdge, n1: GraphNode, n2: GraphNode) {
  const dist = edge.distance_km ?? computeDistance(n1, n2);

  // Basisklasse nach Distanz
  let base =
    dist > 600 ? 4000 :
    dist > 200 ? 1500 :
                 500;

  // Infrastruktur-Faktor
  let factor = 1.0;
  if (edge.connection === "rail") factor = 1.3;
  if (edge.connection === "highway") factor = 1.2;
  if (edge.connection === "road") factor = 1.0;
  if (edge.connection === "port") factor = 2.0;
  if (edge.connection === "air") factor = 3.0;

  return Math.round(base * factor);
}

// --------------------------------------------------------
// DIJKSTRA – Kürzeste Route
// --------------------------------------------------------
export function findShortestPath(graph: Graph, start: string, end: string): string[] {
  const distances: Record<string, number> = {};
  const prev: Record<string, string | undefined> = {};
  const visited = new Set<string>();

  graph.nodes.forEach((n) => (distances[n.name] = Infinity));
  distances[start] = 0;

  while (true) {
    let current: string | null = null;
    let currentDist = Infinity;

    for (const node in distances) {
      if (!visited.has(node) && distances[node] < currentDist) {
        current = node;
        currentDist = distances[node];
      }
    }

    if (current === null) break;
    if (current === end) break;

    visited.add(current);

    const neighbors = graph.edges.filter((e) => e.from === current);

    for (const e of neighbors) {
      const alt = distances[current] + (e.distance_km ?? 1);
      if (alt < distances[e.to]) {
        distances[e.to] = alt;
        prev[e.to] = current;
      }
    }
  }

  const path: string[] = [];
  let u: string | undefined = end;

  while (u) {
    path.unshift(u);
    u = prev[u];
  }

  return path;
}

// --------------------------------------------------------
// Alternative Route – einfache 2. beste Route
// --------------------------------------------------------
export function findAlternativePath(graph: Graph, start: string, end: string): string[] {
  const routeA = findShortestPath(graph, start, end);

  // route too short → no alternative possible
  if (routeA.length < 3) return routeA;

  // randomly remove one edge from route A to force a different path
  const idx = Math.floor(Math.random() * (routeA.length - 1));
  const removeFrom = routeA[idx];
  const removeTo = routeA[idx + 1];

  const tempGraph: Graph = {
    nodes: graph.nodes,
    edges: graph.edges.filter(
      (e) => !(e.from === removeFrom && e.to === removeTo)
    )
  };

  const routeB = findShortestPath(tempGraph, start, end);

  // fallback: if routeB is invalid, use routeA
  if (!routeB || routeB.length < 2) return routeA;

  return routeB;
}

// --------------------------------------------------------
// Shipment Generator
// --------------------------------------------------------
export interface Shipment {
  from: string;
  to: string;
  quantity: number;
}

// Zufällige Erstellung kleiner Transportaufträge
export function generateShipments(graph: Graph, count: number): Shipment[] {
  const shipments: Shipment[] = [];
  const nodes = graph.nodes.map((n) => n.name);

  for (let i = 0; i < count; i++) {
    const from = nodes[Math.floor(Math.random() * nodes.length)];
    let to = nodes[Math.floor(Math.random() * nodes.length)];
    while (to === from) {
      to = nodes[Math.floor(Math.random() * nodes.length)];
    }
    shipments.push({ from, to, quantity: 1 });
  }

  return shipments;
}

// --------------------------------------------------------
// 80/20 ROUTING + Heatmap-Usage-Berechnung
// --------------------------------------------------------
export function runSimulation(
  graph: Graph,
  shipments: Shipment[],
  mainRouteShare: number
) {
  const edgeUsage: Record<string, number> = {};
  const mainRouteUsage: Record<string, number> = {};
  const altRouteUsage: Record<string, number> = {};

  function addUsageTo(map: Record<string, number>, path: string[]) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`;
      map[key] = (map[key] || 0) + 1;
    }
  }

  function addUsage(path: string[]) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`;
      edgeUsage[key] = (edgeUsage[key] || 0) + 1;
    }
  }

  function addUsageMulti(path: string[], quantity: number) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`;
      edgeUsage[key] = (edgeUsage[key] || 0) + quantity;
    }
  }

  function getRoutesForShipment(s: Shipment) {
    const routeA = findShortestPath(graph, s.from, s.to);
    const routeB = findAlternativePath(graph, s.from, s.to);
    return { routeA, routeB };
  }

  shipments.forEach((s) => {
    const { routeA, routeB } = getRoutesForShipment(s);

    // mainRouteShare is already a 0–1 fraction from App.tsx
    const share = mainRouteShare;

    const useMain = Math.random() < share;
    const chosenRoute = useMain ? routeA : routeB;

    addUsageMulti(chosenRoute, s.quantity);

    if (useMain) {
      addUsageTo(mainRouteUsage, routeA);
    } else {
      addUsageTo(altRouteUsage, routeB);
    }
  });

  let bottleneckCount = 0;
  let worstEdge = "";
  let maxLoad = 0;

  graph.edges.forEach((e) => {
    const key = `${e.from}→${e.to}`;
    const used = edgeUsage[key] || 0;

    const n1 = graph.nodes.find(n => n.name === e.from);
    const n2 = graph.nodes.find(n => n.name === e.to);
    if (!n1 || !n2) return;

    const capacity = computeCapacityClass(e, n1, n2);
    const lf = used / capacity;

    if (lf > maxLoad) {
      maxLoad = lf;
      worstEdge = key;
    }
    if (lf > 1.0) bottleneckCount++;
  });

  return {
    edgeUsage,
    mainRouteUsage,
    altRouteUsage,
    
    metrics: {
      bottleneckCount,
      maxLoad,
      worstEdge
    }
  };
}
