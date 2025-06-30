import CustomException from "../../classes/custom_exception.js";
import { executeQuery, updateRedis } from "../../db.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";
import { logCyan } from "../../src/functions/logsCustom.js";
import { asignar } from "./assign.js";

export async function verifyAssignment(
    dbConnection,
    company,
    userId,
    profile,
    dataQr,
    driverId,
    deviceFrom
) {
    const shipmentId = await getShipmentIdFromQr(company.did, dataQr)

    let hoy = new Date();
    hoy.setDate(hoy.getDate() - 3);
    hoy = hoy.toISOString().split("T")[0];

    let sql = `
                SELECT e.did, e.quien, sua.perfil, e.autofecha, e.estadoAsignacion
                FROM envios AS e
                LEFT JOIN sistema_usuarios_accesos AS sua 
                    ON sua.usuario = e.quien AND sua.superado = 0 AND sua.elim = 0
                WHERE e.did = ${shipmentId} AND e.superado = 0 AND e.elim = 0 AND e.autofecha > ${hoy}
                ORDER BY e.autofecha ASC
            `;
    const envios = await executeQuery(dbConnection, sql, []);

    if (envios.length === 0) {
        throw new CustomException({
            title: "No se encontró el paquete",
            message: "El paquete no existe o ha sido eliminado.",
        });
    }
    logCyan("Obtengo el envío");

    const envio = envios[0];

    let ponerEnEstado1 = false;
    let ponerEnEstado2 = false;
    let ponerEnEstado3 = false;
    let ponerEnEstado4 = false;
    let ponerEnEstado5 = false;

    let estadoAsignacion = envio.estadoAsignacion;

    let resultHistorial = await executeQuery(
        dbConnection,
        "SELECT estado, didCadete FROM envios_historial WHERE didEnvio = ? AND superado = 0 LIMIT 1",
        [shipmentId]
    );

    let didCadete =
        resultHistorial.length > 0 ? resultHistorial[0].didCadete : null;
    let esElMismoCadete = didCadete === driverId;

    if (esElMismoCadete) {
        logCyan("Es el mismo cadete");
        if (profile === 1 && estadoAsignacion === 1) {
            logCyan("Es el mismo cadete, es perfil 1 y estadoAsignacion 1");
            return {
                success: false,
                message: "Este paquete ya fue asignado a este cadete",
            };
        }
        if (profile === 3 && estadoAsignacion === 2) {
            logCyan("Es el mismo cadete, es perfil 3 y estadoAsignacion 2");
            return {
                success: false,
                message: "Este paquete ya fue auto asignado a este cadete",
            };
        }
        if (profile === 5 && [3, 4, 5].includes(estadoAsignacion)) {
            logCyan("Es el mismo cadete, es perfil 5 y estadoAsignacion 3, 4 o 5");
            return { success: false, message: "Este paquete ya fue confirmado" };
        }
    } else {
        if (profile === 1 && estadoAsignacion === 1) {
            logCyan("Es perfil 1 y estadoAsignacion 1");
            const insertSql = `INSERT INTO asignaciones_fallidas (did, operador, didEnvio, quien, tipo_mensaje, desde) VALUES (?, ?, ?, ?, ?, ?)`;
            await executeQuery(dbConnection, insertSql, [
                "",
                userId,
                shipmentId,
                driverId,
                1,
                deviceFrom,
            ]);
            throw new CustomException({
                title: "Asignación Error",
                message: "Este paquete ya fue asignado a otro cadete",
            });
        }
        if (profile === 3 && [2, 3].includes(estadoAsignacion)) {
            logCyan("Es perfil 3 y estadoAsignacion 2");

            const insertSql = `INSERT INTO asignaciones_fallidas ( operador, didEnvio, quien, tipo_mensaje, desde) VALUES (?, ?, ?, ?, ?)`;
            await executeQuery(dbConnection, insertSql, [

                userId,
                shipmentId,
                driverId,
                2,
                deviceFrom,
            ]);
            throw new CustomException({
                title: "Asignación Error",
                message: "Este paquete ya fue auto asignado por otro cadete",
            });
        }
        if (profile === 5 && [1, 3, 4, 5].includes(estadoAsignacion)) {
            logCyan("Es perfil 5 y estadoAsignacion 1, 3, 4 o 5");
            const insertSql = `INSERT INTO asignaciones_fallidas (did, operador, didEnvio, quien, tipo_mensaje, desde) VALUES (?, ?, ?, ?, ?, ?)`;
            await executeQuery(dbConnection, insertSql, [
                "",
                userId,
                shipmentId,
                driverId,
                3,
                deviceFrom,
            ]);
            throw new CustomException({
                title: "Asignación Error",
                message: "Este paquete ya fue confirmado a otro cadete",
            });
        }
    }

    if (profile === 1 && estadoAsignacion === 0) ponerEnEstado1 = true;
    if (profile === 3 && estadoAsignacion === 1) ponerEnEstado2 = true;
    if (profile === 5 && estadoAsignacion === 0) ponerEnEstado5 = true;
    if (profile === 5 && estadoAsignacion === 1) ponerEnEstado4 = true;
    if (profile === 5 && estadoAsignacion === 2) ponerEnEstado3 = true;

    let noCumple = false;
    let message = "No se puede asignar el paquete.";

    if (ponerEnEstado1) {
        await executeQuery(
            dbConnection,
            "UPDATE envios SET estadoAsignacion = 1 WHERE superado = 0 AND elim = 0 AND did = ?",
            [shipmentId]
        );
        message = "Asignado correctamente.";
        logCyan("Pongo en estado 1");
    } else if (ponerEnEstado2) {
        await executeQuery(
            dbConnection,
            "UPDATE envios SET estadoAsignacion = 2 WHERE superado = 0 AND elim = 0 AND did = ?",
            [shipmentId]
        );
        message = "Autoasignado correctamente.";
        logCyan("Pongo en estado 2");
    } else if (ponerEnEstado3) {
        await executeQuery(
            dbConnection,
            "UPDATE envios SET estadoAsignacion = 3 WHERE superado = 0 AND elim = 0 AND did = ?",
            [shipmentId]
        );
        message = "Confirmado correctamente.";
        logCyan("Pongo en estado 3");
    } else if (ponerEnEstado4) {
        await executeQuery(
            dbConnection,
            "UPDATE envios SET estadoAsignacion = 4 WHERE superado = 0 AND elim = 0 AND did = ?",
            [shipmentId]
        );
        message = "Confirmado correctamente.";
        logCyan("Pongo en estado 4");
    } else if (ponerEnEstado5) {
        await executeQuery(
            dbConnection,
            "UPDATE envios SET estadoAsignacion = 5 WHERE superado = 0 AND elim = 0 AND did = ?",
            [shipmentId]
        );
        message = "Asignado correctamente.";
        logCyan("Pongo en estado 5");
    } else {
        noCumple = true;
    }

    if (noCumple) {
        throw new CustomException({
            title: "Asignación Error",
            message: message,
        });
    } else {
        await asignar(
            dbConnection,
            company,
            userId,
            driverId,
            deviceFrom,
            shipmentId
        );
        logCyan("Asignado correctamente");

        await updateRedis(company.did, shipmentId, driverId);
        logCyan("Actualizo Redis con la asignación");

        return { success: true, message };
    }
}
