import { executeQuery } from "../../db.js";
import { checkIfFulfillment } from "../../src/functions/checkIfFulfillment.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";
import { logBlue, logCyan } from "../../src/functions/logsCustom.js";
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
    const startTime = performance.now();
    const shipmentId = await getShipmentIdFromQr(company.did, dataQr);
    logBlue(`Tiempo de getShipmentIdFromQr: ${performance.now() - startTime} ms`);
    await checkIfFulfillment(dbConnection, shipmentId);
    logBlue(`Tiempo de checkIfFulfillment: ${performance.now() - startTime} ms`);
    if (company.did != 4) {
        const sqlAsignado = `SELECT id FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ? AND operador = ?`;
        const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [shipmentId, driverId]);
        logBlue(`Tiempo de consulta de envios_asignaciones: ${performance.now() - startTime} ms`);
        if (asignadoRows.length > 0) {
            return {
                feature: "asignacion",
                success: false,
                message: "El paquete ya se encuentra asignado a este chofer.",
            };
        }
    }
    logCyan("El paquete todavia no está asignado");
    const estadoQuery = `SELECT estado FROM envios WHERE superado=0 AND elim=0 AND did = ?`;
    const estadoRows = await executeQuery(dbConnection, estadoQuery, [shipmentId]);
    logBlue(`Tiempo de consulta de estado del paquete: ${performance.now() - startTime} ms`);
    logCyan("Obtengo el estado del paquete");

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
    logBlue(`Tiempo de creación de tabla y usuario: ${performance.now() - startTime} ms`);
    const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await executeQuery(dbConnection, insertSql, [
        "",
        driverId,
        shipmentId,
        estado,
        userId,
        deviceFrom,
    ]);
    logBlue(`Tiempo de inserción en envios_asignaciones: ${performance.now() - startTime} ms`);
    logCyan("Inserto en la tabla de asignaciones");

    const did = result.insertId;

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


    await Promise.all(queries.map(({ sql, values }, index) => {
        executeQuery(dbConnection, sql, values);
        logBlue(`(${index}) Tiempo de ejecución de query: ${performance.now() - startTime} ms`);
    }));
    logCyan("Updateo las tablas");

    await insertAsignacionesDB(
        company.did,
        did,
        driverId,
        estado,
        userId,
        deviceFrom
    );
    logBlue(`Tiempo de insertAsignacionesDB: ${performance.now() - startTime} ms`);
    logCyan("Inserto en la base de datos individual de asignaciones");

    // await updateRedis(company.did, shipmentId, driverId);
    logCyan("Actualizo Redis con la asignación");

    const resultado = {
        feature: "asignacion",
        success: true,
        message: "Asignación realizada correctamente",
    };

    return resultado;
}