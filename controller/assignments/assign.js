
import { executeQuery } from "../../db.js";
import { checkIfFulfillment } from "../../src/functions/checkIfFulfillment.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";
import { crearTablaAsignaciones } from "../functions/crearTablaAsignaciones.js";
import { crearUsuario } from "../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";

export async function asignar(
    dbConnection,
    company,
    userId,
    dataQr,
    driverId,
    deviceFrom
) {
    const shipmentId = await getShipmentIdFromQr(company.did, dataQr);
    await checkIfFulfillment(dbConnection, shipmentId);
    if (company.did != 4) {
        const sqlAsignado = `SELECT id FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ? AND operador = ?`;
        const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [shipmentId, driverId]);
        if (asignadoRows.length > 0) {
            return {
                feature: "asignacion",
                success: false,
                message: "El paquete ya se encuentra asignado a este chofer.",
            };
        }
    }
    const estadoQuery = `SELECT estado FROM envios WHERE superado=0 AND elim=0 AND did = ?`;
    const estadoRows = await executeQuery(dbConnection, estadoQuery, [shipmentId]);

    if (estadoRows.length === 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "No se pudo obtener el estado del paquete.",
        };
    }

    const estado = estadoRows[0].estado;

    await Promise.allSettled([
        crearTablaAsignaciones(company.did),
        crearUsuario(company.did),
    ]);
    const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await executeQuery(dbConnection, insertSql, [
        "",
        driverId,
        shipmentId,
        estado,
        userId,
        deviceFrom,
    ]);

    const did = result.insertId;

    if (!did) {
        throw new Error("Error en la asignacion");
    }

    const queries = [
        { sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim=0 AND id = ?`, values: [did, did] },
        { sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim=0 AND didEnvio = ? AND did != ?`, values: [shipmentId, did] },
        { sql: `UPDATE envios SET choferAsignado = ? WHERE superado=0 AND elim=0 AND did = ?`, values: [driverId, shipmentId] },
        // Esta query solo se incluye si company.did !== 4
        ...(company.did != 4
            ? [{ sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim=0 AND didPaquete = ?`, values: [shipmentId] }]
            : []),
        // { sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim=0 AND didEnvio = ?`, values: [driverId, shipmentId] },
        { sql: `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim=0 AND did = ?`, values: [shipmentId] },
    ];

    await Promise.all(
        queries.map(({ sql, values }) => executeQuery(dbConnection, sql, values))
    );

    await insertAsignacionesDB(
        company.did,
        did,
        driverId,
        estado,
        userId,
        deviceFrom
    );

    // await updateRedis(company.did, shipmentId, driverId);

    const resultado = {
        feature: "asignacion",
        success: true,
        message: "Asignación realizada correctamente",
    };
    return resultado;
}