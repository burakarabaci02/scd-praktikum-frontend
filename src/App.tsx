import React, { useEffect, useState } from "react";
import TransportMap from "./components/TransportMap";
import SimulationPanel from "./components/SImulationPanel";
import KPIDashboard from "./components/KPIDashboard";
import { KPI_LIST } from "./kpiDefinitions";
import { connectWebSocket, onGraph, onEvent } from "./websocket/ws";
import { runSimulation } from "./simlation";
import type { Graph } from "./types/Graph";

export default function App() {
    const [graph, setGraph] = useState<Graph | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [edgeUsage, setEdgeUsage] = useState<Record<string, number>>({});
    const [mainRouteUsage, setMainRouteUsage] = useState<Record<string, number>>({});
    const [altRouteUsage, setAltRouteUsage] = useState<Record<string, number>>({});
    const [frozenRouteA, setFrozenRouteA] = useState<string[]>([]);
    const [frozenRouteB, setFrozenRouteB] = useState<string[]>([]);
    const [topBottlenecks, setTopBottlenecks] = useState<
        { from: string; to: string; load: number }[]
    >([]);

    const [centralityData, setCentralityData] = useState<any | null>(null);
    const [centralityMode, setCentralityMode] = useState<string>("none");
    const [kpiInput, setKpiInput] = useState<any | null>(null);
    const [kpis, setKpis] = useState<Record<string, any>>({});

    useEffect(() => {
        connectWebSocket();

        onGraph((g) => {
            console.log("Graph geladen:", g);
            setGraph(g as Graph);
            setEdgeUsage({}); // Reset heatmap when new graph arrives
        });

        onEvent((ev) => {
            setEvents((prev) => [...prev, ev]);
        });

        // Zentralitätsdaten laden
        fetch("/centrality.json")
            .then((res) => res.json())
            .then((data) => {
                console.log("Centrality loaded:", data);
                setCentralityData(data);
            })
            .catch((err) => console.error("Fehler beim Laden der Zentralität:", err));
    }, []);

    function handleRunSimulation(settings: {
        shipments: { from: string; to: string; quantity: number }[];
        mainRouteShare: number; // already 0–1
    }) {
        if (!graph) return;

        const result = runSimulation(
            graph,
            settings.shipments,      // full list of transports from the panel
            settings.mainRouteShare  // already a 0–1 value
        );

        setEdgeUsage(result.edgeUsage);
        setMainRouteUsage(result.mainRouteUsage);
        setAltRouteUsage(result.altRouteUsage);
        setKpiInput({
            shipments: settings.shipments,
            edgeUsage: result.edgeUsage,
            capacities: {}
        });
        if (graph) {
            const computed: Record<string, any> = {};
            KPI_LIST.forEach(kpi => {
                computed[kpi.id] = {
                    label: kpi.label,
                    icon: kpi.icon,
                    value: kpi.compute({
                        shipments: settings.shipments,
                        edgeUsage: result.edgeUsage,
                        capacities: {}
                    })
                };
            });
            setKpis(computed);
        }
    }

    function handleRunGlobalSimulation() {
        if (!graph) return;

        const shipments: { from: string; to: string; quantity: number }[] = [];

        graph.nodes.forEach((a) => {
            graph.nodes.forEach((b) => {
                if (a.name === b.name) return;

                shipments.push({
                    from: a.name,
                    to: b.name,
                    quantity: Math.floor(40 + Math.random() * 100),
                });
            });
        });

        const result = runSimulation(graph, shipments, 0.8);

        setEdgeUsage(result.edgeUsage);
        setMainRouteUsage(result.mainRouteUsage);
        setAltRouteUsage(result.altRouteUsage);
        setKpiInput({
            shipments,
            edgeUsage: result.edgeUsage,
            capacities: {}
        });
        if (graph) {
            const computed: Record<string, any> = {};
            KPI_LIST.forEach(kpi => {
                computed[kpi.id] = {
                    label: kpi.label,
                    icon: kpi.icon,
                    value: kpi.compute({
                        shipments,
                        edgeUsage: result.edgeUsage,
                        capacities: {}
                    })
                };
            });
            setKpis(computed);
        }
    }

    if (!graph) return <div>Graph wird geladen…</div>;

    return (
        <>
            <SimulationPanel
                onRunSimulation={handleRunSimulation}
                onRunGlobalSimulation={handleRunGlobalSimulation}
                topBottlenecks={topBottlenecks}
                centralityMode={centralityMode}
                onCentralityModeChange={setCentralityMode}
                kpiInput={kpiInput}
            />
            <TransportMap
                graph={graph}
                events={events}
                edgeUsage={edgeUsage}
                mainRouteUsage={mainRouteUsage}
                altRouteUsage={altRouteUsage}
                onBottlenecksChanged={setTopBottlenecks}
                centralityData={centralityData}
                centralityMode={centralityMode}
                topBottlenecks={topBottlenecks}
            />
            <KPIDashboard values={kpis} />
        </>
    );
}