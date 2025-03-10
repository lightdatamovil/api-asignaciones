import { executeQuery } from "../../db.js";

export async function idFromLightdataShipment(company, dataQr, dbConnection) {
    const companyIdFromShipment = dataQr.empresa;

    const shipmentId = dataQr.did;

    if (company.did != companyIdFromShipment) {
        try {
            const sql = `SELECT didLocal FROM envios_exteriores WHERE superado=0 AND elim=0 AND didExterno = ? AND didEmpresa = ?`;
            const rows = await executeQuery(dbConnection, sql, [companyIdFromShipment, companyIdFromShipment]);

            if (rows.length > 0) {
                shipmentId = rows[0]["didLocal"];
                return shipmentId;
            } else {
                throw new Error("El paquete externo no existe en la logística.");
            }
        } catch (error) {
            console.error("Error al obtener el id del envío:", error);
            throw error;
        }
    } else {
        console.log('1,' + shipmentId);

        return shipmentId;
    }
}

export async function idFromFlexShipment(shipmentId, dbConnection) {
    try {
        const query = `SELECT did FROM envios WHERE flex=1 AND superado=0 AND elim=0 AND ml_shipment_id = ? LIMIT 1`;
        const rows = await executeQuery(dbConnection, query, [shipmentId]);

        if (rows.length > 0) {
            const didenvio = rows[0].did;

            return didenvio;
        } else {
            throw new Error("El paquete flex no se encontró en la base de datos.");
        }
    } catch (error) {
        console.error("Error al obtener el id del envío:", error);
        throw error;
    }
}