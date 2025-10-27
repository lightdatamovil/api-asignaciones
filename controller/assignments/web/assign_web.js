import { checkIfFulfillment, executeQuery, getHeaders, sendShipmentStateToStateMicroserviceAPI } from "lightdata-tools";
import { crearTablaAsignaciones } from "../../functions/crearTablaAsignaciones.js";
import { crearUsuario } from "../../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../../functions/insertAsignacionesDB.js";
import { urlEstadosMicroservice } from "../../../db.js";

export async function asignar_web(
    dbConnection,
    req,
    company,
) {
    const { shipmentId, driverId } = req.body;
    const { userId } = req.user;
    const { deviceFrom } = getHeaders(req);
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
    const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim<>1 AND didEnvio = ?`;
    const estadoRows = await executeQuery(dbConnection, estadoQuery, [
        shipmentId,
    ]);

    if (estadoRows.length === 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "No se pudo obtener el estado del paquete.",
        };
    }

    const estado = estadoRows[0].estado;

    await crearTablaAsignaciones(company.did);

    await crearUsuario(company.did);

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
    if (estado == 5 || estado == 9) {
        sendShipmentStateToStateMicroserviceAPI(urlEstadosMicroservice, company, userId, shipmentId, estado);
    }
    const queries = [
        { sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim<>1 AND id = ?`, values: [did, did], },
        { sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim<>1 AND didEnvio = ? AND did != ?`, values: [shipmentId, did], },
        { sql: `UPDATE envios SET choferAsignado = ? WHERE superado=0 AND elim<>1 AND did = ?`, values: [driverId, shipmentId], },
        { sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim<>1 AND didPaquete = ?`, values: [shipmentId], },
        // { sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim<>1 AND didEnvio = ?`, values: [driverId, shipmentId], },
        { sql: `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim<>1 AND did = ?`, values: [shipmentId], },
    ];

    for (const { sql, values } of queries) {
        await executeQuery(dbConnection, sql, values);
    }


    // porque no inserto shipmentId
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