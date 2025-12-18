let ws: WebSocket | null = null;

let eventCallbacks: ((ev: any) => void)[] = [];
let graphCallbacks: ((graph: any) => void)[] = [];

export function connectWebSocket() {
    ws = new WebSocket(import.meta.env.VITE_WS_URL);

    ws.onopen = () => console.log("WS: Verbindung hergestellt.");

    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "graph_init") {
            graphCallbacks.forEach(cb => cb(data.graph));
            return;
        }

        eventCallbacks.forEach(cb => cb(data));
    };
}

export function onGraph(callback: (graph: any) => void) {
    graphCallbacks.push(callback);
}

export function onEvent(callback: (ev: any) => void) {
    eventCallbacks.push(callback);
}