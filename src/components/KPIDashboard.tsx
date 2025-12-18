import React from "react";

interface KPIEntry {
    label: string;
    icon: string;
    value: string | number;
}

interface KPIDashboardProps {
    values: Record<string, KPIEntry>;
}

export default function KPIDashboard({ values }: KPIDashboardProps) {
    if (!values) return null;

    const entries = Object.entries(values);

    return (
        <div
            style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                width: "260px",
                background: "rgba(0,0,0,0.75)",
                color: "white",
                padding: "15px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                zIndex: 99999
            }}
        >
            <h3 style={{ marginTop: 0 }}>📊 KPI Dashboard</h3>

            {entries.map(([id, k]) => (
                <div
                    key={id}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        padding: "6px 0"
                    }}
                >
                    <span>{k.icon} {k.label}</span>
                    <strong>{k.value}</strong>
                </div>
            ))}
        </div>
    );
}