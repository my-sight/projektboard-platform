
export const DEFAULT_COLS = [
    { id: "c1", name: "P1", done: false },
    { id: "c2", name: "P2", done: false },
    { id: "c3", name: "P3", done: false },
    { id: "c4", name: "P4", done: false },
    { id: "c5", name: "P5", done: false },
    { id: "c6", name: "P6", done: false },
    { id: "c7", name: "P7", done: false },
    { id: "c8", name: "P8", done: true }
];

export const DEFAULT_TEMPLATES: Record<string, string[]> = {};
DEFAULT_COLS.forEach(col => {
    DEFAULT_TEMPLATES[col.name] = ["Anforderungen prüfen", "Dokumentation erstellen", "Qualitätskontrolle"];
});

export const STATUS_KEYS = ['message', 'qualitaet', 'kosten', 'termine'] as const;
