import { executeQuery, getHeaders } from "lightdata-tools";
import { asignar_web } from "./assign_web.js";

export async function verificarAsignacionWeb(
    dbConnection,
    req,
    company,
) {
    const { shipmentId, driverId } = req.body;
    const { userId, profile } = req.user;
    const { deviceFrom } = getHeaders(req);
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

    const [envio] = await executeQuery(dbConnection, sql, []);

    if (!envio) {
        return {
            success: false,
            message: "No se encontró el paquete",
        };
    }

    let estadoAsignacion = envio.estadoAsignacion;

    let resultHistorial = await executeQuery(
        dbConnection,
        "SELECT estado, didCadete FROM envios_historial WHERE didEnvio = ? AND superado = 0 LIMIT 1",
        [shipmentId]
    );

    let didCadete = resultHistorial.length > 0 ? resultHistorial[0].didCadete : null;

    let esElMismoCadete = didCadete === driverId;

    const errorCases = [
        {
            condition: esElMismoCadete && profile === 1 && estadoAsignacion === 1,
            log: "Es el mismo cadete, es perfil 1 y estadoAsignacion 1",
            message: "Este paquete ya fue asignado a este cadete",
        },
        {
            condition: esElMismoCadete && profile === 3 && estadoAsignacion === 2,
            log: "Es el mismo cadete, es perfil 3 y estadoAsignacion 2",
            message: "Este paquete ya fue autoasignado a este cadete",
        },
        {
            condition: esElMismoCadete && profile === 5 && [3, 4, 5].includes(estadoAsignacion),
            log: "Es el mismo cadete, es perfil 5 y estadoAsignacion 3, 4 o 5",
            message: "Este paquete ya fue confirmado a este cadete",
        },
        {
            condition: !esElMismoCadete && profile === 1 && estadoAsignacion === 1,
            log: "Es perfil 1 y estadoAsignacion 1",
            message: "Este paquete ya fue asignado a otro cadete",
            tipo_mensaje: 1,
        },
        {
            condition: !esElMismoCadete && profile === 3 && [1, 2, 3, 4, 5].includes(estadoAsignacion),
            log: "Es perfil 3 y estadoAsignacion " + estadoAsignacion,
            message: "No tenes el paquete asignado",
            tipo_mensaje: 2,
        },
        {
            condition: !esElMismoCadete && profile === 5 && [1, 3, 4, 5].includes(estadoAsignacion),
            log: "Es perfil 5 y estadoAsignacion 1, 3, 4 o 5",
            message: "Este paquete ya fue confirmado a otro cadete",
            tipo_mensaje: 3,
        },
    ];

    for (const err of errorCases) {
        if (err.condition) {
            if (err.tipo_mensaje) {
                const insertSql = `INSERT INTO asignaciones_fallidas (operador, didEnvio, quien, tipo_mensaje, desde) VALUES (?, ?, ?, ?, ?)`;
                await executeQuery(dbConnection, insertSql, [
                    userId,
                    shipmentId,
                    driverId,
                    err.tipo_mensaje,
                    deviceFrom,
                ]);
            }
            return {
                success: false,
                message: err.message,
            };
        }
    }

    const transitions = [
        {
            condition: profile === 1 && estadoAsignacion === 0,
            updateState: 1,
            message: "Asignado correctamente.",
            log: "Puse en estado 1"
        },
        {
            condition: profile === 3 && estadoAsignacion === 1 && esElMismoCadete,
            updateState: 2,
            message: "Autoasignado correctamente.",
            log: "Puse en estado 2"
        },
        {
            condition: profile === 5 && estadoAsignacion === 2 && esElMismoCadete,
            updateState: 3,
            message: "Confirmado correctamente.",
            log: "Puse en estado 3"
        },
        {
            condition: profile === 5 && estadoAsignacion === 1 && esElMismoCadete,
            updateState: 4,
            message: "Confirmado correctamente.",
            log: "Puse en estado 4"
        },
        {
            condition: profile === 5 && estadoAsignacion === 0,
            updateState: 5,
            message: "Asignado correctamente.",
            log: "Puse en estado 5"
        }
    ];

    let transition = transitions.find(t => t.condition);

    if (!transition) {
        return {
            success: false,
            message: "No se puede asignar el paquete.",
        };
    }

    await executeQuery(
        dbConnection,
        "UPDATE envios SET estadoAsignacion = ? WHERE superado = 0 AND elim = 0 AND did = ?",
        [transition.updateState, shipmentId]
    );

    await asignar_web(
        dbConnection,
        company,
        userId,
        shipmentId,
        driverId,
        deviceFrom
    );

    return { success: true, message: transition.message };
}
