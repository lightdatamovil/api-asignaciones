import { executeQuery, getCompanyByCode } from "../../db.js";
import { debugHttpError } from "../../src/functions/debugEndpoint.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";
import { logCyan } from "../../src/functions/logsCustom.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";
import { choferEsLogistica } from "../../src/functions/choferEsLogistica.js";

const URL_ELIMINAR_ENVIO = "https://altaenvios.lightdata.com.ar/api/eliminarEnvio";

export async function desasignar(dbConnection, company, userId, body, deviceFrom) {

    const dataQr = body.dataQr;
    const quien = userId;

    const shipmentId = await getShipmentIdFromQr(company.did, dataQr);
    if (!shipmentId) {

        return {
            feature: "asignacion",
            success: false,
            message: "Error al obtener el id del envio",
        };
    }

    const sqlOperador =
        "SELECT operador, estado FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, sqlOperador, [shipmentId], true);

    const operador = result.length > 0 ? result[0].operador : 0;

    if (operador == 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "El paquete ya está desasignado.",
        };
    }
    logCyan("El paquete está asignado");

    const operadorEsLogistica = await choferEsLogistica(dbConnection, operador);

    if (operadorEsLogistica) {

        console.log(operadorEsLogistica);

        //traer de redis el did de la compania externa por el codvinculacion
        const companiaExterna = await getCompanyByCode(operadorEsLogistica.codvinculacion);

        // verifico en envios historial el didlocal del envio  shipmentId -- 
        const shipmentIdExterno = await getShipmentIdFromQr(companiaExterna.did, dataQr);

        // envio al microservicio eliminar envio de todas las tablas 
        const payload = {
            idEmpresa: companiaExterna.did,
            did: shipmentIdExterno,
            userId: quien,
            desde: deviceFrom,
        };
        console.log(payload);
        try {
            await fetch(URL_ELIMINAR_ENVIO, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            debugHttpError(error, "desasignar - eliminar envio");
        }

    }


    if (company.did == 4) {
        const setEstadoAsignacion =
            "UPDATE envios SET estadoAsignacion = 0 WHERE superado = 0 AND elim=0 AND did = ?";
        await executeQuery(dbConnection, setEstadoAsignacion, [shipmentId]);
    }

    const insertQuery =
        "INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)";
    const resultInsertQuery = await executeQuery(dbConnection, insertQuery, [
        "",
        0,
        shipmentId,
        result[0].estado,
        userId,
        deviceFrom,
    ]);
    logCyan("Inserto en la tabla de asignaciones con el operador 0");

    // Actualizar asignaciones
    await executeQuery(
        dbConnection,
        `UPDATE envios_asignaciones SET did=${resultInsertQuery.insertId} WHERE superado=0 AND elim=0 AND didEnvio = ?`,
        [shipmentId]
    );
    await executeQuery(
        dbConnection,
        `UPDATE envios_asignaciones SET superado=1 WHERE superado=0 AND elim=0 AND didEnvio = ? AND id != ?`,
        [shipmentId, resultInsertQuery.insertId]
    );

    // Actualizar historial
    // await executeQuery(
    //     dbConnection,
    //     `UPDATE envios_historial SET didCadete=0 WHERE superado=0 AND elim=0 AND didEnvio = ?`,
    //     [shipmentId]
    // );

    // Desasignar chofer
    await executeQuery(
        dbConnection,
        `UPDATE envios SET choferAsignado = 0 WHERE superado=0 AND elim=0 AND did = ?`,
        [shipmentId]
    );

    logCyan("Updateo las tablas");

    await insertAsignacionesDB(
        company.did,
        shipmentId,
        0,
        result[0].estado,
        userId,
        deviceFrom
    );
    logCyan("Inserto en la base de datos individual de asignaciones");

    // await updateRedis(company.did, shipmentId, 0);
    logCyan("Updateo redis con la desasignación");

    const resultado = {
        feature: "asignacion",
        success: true,
        message: "Desasignación realizada correctamente",
    };

    return resultado;
}
