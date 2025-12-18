// 🔥 KORREKTER IMPORT – jetzt NICHT mehr "subscribe"
import { onEvent } from "../websocket/ws";

// Event-Speicher
let events: any[] = [];
let callbacks: ((events: any[]) => void)[] = [];

// WebSocket → empfange NUR Live-Events
onEvent((event: any) => {
  console.log("EventHandler: Neues Live-Event:", event);

  // optional: Speicher begrenzen
  events = [...events, event].slice(-500);

  // alle Listener informieren
  callbacks.forEach((cb) => cb(events));
});

// Listener registrieren
export function onEventsUpdate(cb: (events: any[]) => void) {
  console.log("EventHandler: Callback registriert");
  callbacks.push(cb);
}

// Events abrufen
export function getEvents() {
  return events;
}