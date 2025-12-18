

export interface KPI {
    id: string;
    label: string;
    icon: string;
    compute: (data: {
        shipments: { from: string; to: string; quantity: number }[];
        edgeUsage: Record<string, number>;
        capacities: Record<string, number>;
    }) => string | number;
}

export const KPI_LIST: KPI[] = [
    {
        id: "totalShipments",
        label: "Total Shipments",
        icon: "📦",
        compute: ({ shipments }) =>
            shipments.reduce((sum, s) => sum + (s.quantity ?? 0), 0)
    },
    {
        id: "mainRouteShare",
        label: "Main Route Share",
        icon: "📊",
        compute: ({ edgeUsage, capacities }) => {
            let main = 0;
            let total = 0;
            for (const key in edgeUsage) {
                const used = edgeUsage[key];
                const cap = capacities[key] ?? 1;
                total += used;
                if (used <= cap) main += used;
            }
            if (total === 0) return "0%";
            return ((main / total) * 100).toFixed(1) + "%";
        }
    },
    {
        id: "avgLoad",
        label: "Average Network Load",
        icon: "📉",
        compute: ({ edgeUsage, capacities }) => {
            let sum = 0;
            let count = 0;
            for (const key in edgeUsage) {
                const used = edgeUsage[key];
                const cap = capacities[key] ?? 1;
                sum += used / cap;
                count++;
            }
            if (count === 0) return "0%";
            return ((sum / count) * 100).toFixed(1) + "%";
        }
    },
    {
        id: "overloadedEdges",
        label: "Overloaded Edges",
        icon: "🚨",
        compute: ({ edgeUsage, capacities }) => {
            return Object.keys(edgeUsage).filter(
                (e) => edgeUsage[e] > (capacities[e] ?? Number.MAX_SAFE_INTEGER)
            ).length;
        }
    },
    {
        id: "maxLoad",
        label: "Maximum Load",
        icon: "🔥",
        compute: ({ edgeUsage, capacities }) => {
            let maxLoad = 0;
            for (const key in edgeUsage) {
                const used = edgeUsage[key];
                const cap = capacities[key] ?? 1;
                const lf = used / cap;
                if (lf > maxLoad) maxLoad = lf;
            }
            return (maxLoad * 100).toFixed(1) + "%";
        }
    },
    {
        id: "worstBottleneck",
        label: "Worst Bottleneck",
        icon: "🏆",
        compute: ({ edgeUsage, capacities }) => {
            let worst = "";
            let maxLoad = 0;
            for (const key in edgeUsage) {
                const used = edgeUsage[key];
                const cap = capacities[key] ?? 1;
                const lf = used / cap;
                if (lf > maxLoad) {
                    maxLoad = lf;
                    worst = key;
                }
            }
            return worst || "None";
        }
    }
];