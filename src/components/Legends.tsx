import React, { useState } from "react";

export default function Legend() {
    const [open, setOpen] = useState(false);

    return (
        <div style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
        }}>
            {/* Toggle Button */}
            <div
                onClick={() => setOpen(!open)}
                style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "20px",
                    fontWeight: "bold",
                    userSelect: "none",
                    boxShadow: "0 0 8px rgba(0,0,0,0.4)"
                }}
            >
                i
            </div>

            {/* Legend box */}
            {open && (
                <div
                    style={{
                        marginTop: "10px",
                        padding: "12px",
                        width: "220px",
                        background: "rgba(25,25,25,0.9)",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "13px",
                        lineHeight: "1.45",
                        boxShadow: "0 0 12px rgba(0,0,0,0.4)"
                    }}
                >
                    <b style={{ fontSize: "14px" }}>Legende</b>
                    <div style={{ marginTop: "6px" }}>
                        <div>🔵 <b>Hauptroute (A)</b></div>
                        <div>🟢 <b>Alternativroute (B)</b></div>
                        <div>🟣 Weitere Transporte</div>
                        <div>🟡 Knoten (Städte)</div>
                        <div>⬤ Heatmap: <span style={{ color: "#ff4444" }}>Rot = Überlast</span></div>
                        <div>⭕ Kreisgröße = Zentralität</div>
                        <div style={{ marginTop: "4px", opacity: 0.7 }}>
                            * Anzeigen je nach aktivierter Analyse
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}