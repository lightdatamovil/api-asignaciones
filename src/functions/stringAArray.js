export function parseShipmentIds(csv) {
    console.log('csv', csv);
    if (Array.isArray(csv)) return csv;
    if (typeof csv !== "string") return [];
    return Array.from(
        new Set(
            csv
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => Number(s))
                .filter((n) => Number.isFinite(n) && n > 0)
        )
    );
}