import { executeQuery } from "../../db.js";
import { checkIfFulfillment } from "../../src/functions/checkIfFulfillment.js";
import { logCyan } from "../../src/functions/logsCustom.js";
import { crearTablaAsignaciones } from "../functions/crearTablaAsignaciones.js";
import { crearUsuario } from "../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";


export async function asignar_web(
    dbConnection,
    company,
    userId,
    shipmentId,
    driverId,
    deviceFrom
) {
    await checkIfFulfillment(dbConnection, shipmentId);

    const sqlAsignado = `SELECT id, estado FROM envios_asignaciones WHERE superado=0 AND elim<>1 AND didEnvio = ? AND operador = ?`;
    const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [shipmentId, driverId]);

    if (asignadoRows.length > 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "El paquete ya se encuentra asignado a este chofer.",
        };
    }
    logCyan("El paquete todavia no está asignado");
    const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim<>1 AND didEnvio = ?`;
    const estadoRows = await executeQuery(dbConnection, estadoQuery, [
        shipmentId,
    ]);
    logCyan("Obtengo el estado del paquete");

    if (estadoRows.length === 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "No se pudo obtener el estado del paquete.",
        };
    }

    const estado = estadoRows[0].estado;

    await crearTablaAsignaciones(company.did);
    logCyan("Creo la tabla de asignaciones");

    await crearUsuario(company.did);
    logCyan("Creo el usuario");

    const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await executeQuery(dbConnection, insertSql, [
        "",
        driverId,
        shipmentId,
        estado,
        userId,
        deviceFrom,
    ]);
    logCyan("Inserto en la tabla de asignaciones");

    const did = result.insertId;

    const queries = [
        { sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim<>1 AND id = ?`, values: [did, did], },
        { sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim<>1 AND didEnvio = ? AND did != ?`, values: [shipmentId, did], },
        { sql: `UPDATE envios SET choferAsignado = ? WHERE superado=0 AND elim<>1 AND did = ?`, values: [driverId, shipmentId], },
        { sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim<>1 AND didPaquete = ?`, values: [shipmentId], },
        { sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim<>1 AND didEnvio = ?`, values: [driverId, shipmentId], },
        { sql: `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim<>1 AND did = ?`, values: [shipmentId], },
    ];

    for (const { sql, values } of queries) {
        await executeQuery(dbConnection, sql, values);
    }
    logCyan("Updateo las tablas");


    // porque no inserto shipmentId
    await insertAsignacionesDB(
        company.did,
        did,
        driverId,
        estado,
        userId,
        deviceFrom
    );
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