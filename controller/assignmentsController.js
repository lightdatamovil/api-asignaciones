import { executeQuery, getProdDbConfig, updateRedis } from '../db.js';
import { idFromFlexShipment, idFromLightdataShipment } from '../src/functions/identifyShipment.js';
import { createAssignmentsTable, createUser, insertAsignacionesDB } from '../src/functions/db_local.js';
import mysql from 'mysql';

export async function asignar(company, userId, dataQr, driverId, deviceFrom) {
    const dbConfig = getProdDbConfig(company);
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    try {
        const isFlex = dataQr.hasOwnProperty("sender_id");

        const shipmentId = isFlex
            ? await idFromFlexShipment(dataQr.id, dbConnection)
            : await idFromLightdataShipment(company, dataQr, dbConnection);

        const sqlAsignado = `SELECT id, estado FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ? AND operador = ?`;
        const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [shipmentId, driverId]);
        console.log('asignadoRows', asignadoRows);

        if (asignadoRows.length > 0) {
            return { success: false, message: "El paquete ya se encuentra asignado a este chofer." };
        }

        const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim=0 AND didEnvio = ?`;

        const estadoRows = await executeQuery(dbConnection, estadoQuery, [shipmentId]);

        if (estadoRows.length === 0) {
            throw new Error("No se pudo obtener el estado del paquete.");
        }

        const estado = estadoRows[0].estado;

        await createAssignmentsTable(company.did, dbConnection);

        await createUser(company.did, dbConnection);

        const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)`;

        const result = await executeQuery(dbConnection, insertSql, ["", driverId, shipmentId, estado, userId, deviceFrom]);

        const did = result.insertId;

        const queries = [
            { sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim=0 AND id = ?`, values: [did, did] },
            { sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim=0 AND didEnvio = ? AND did != ?`, values: [shipmentId, did] },
            { sql: `UPDATE envios SET choferAsignado = ? WHERE superado=0 AND elim=0 AND did = ?`, values: [driverId, shipmentId] },
            { sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim=0 AND didPaquete = ?`, values: [shipmentId] },
            { sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim=0 AND didEnvio = ?`, values: [driverId, shipmentId] },
            { sql: `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim=0 AND did = ?`, values: [shipmentId] }
        ];

        for (const { sql, values } of queries) {
            await executeQuery(dbConnection, sql, values);
        }

        await insertAsignacionesDB(company.did, did, driverId, estado, userId, deviceFrom);

        await updateRedis(company.did, shipmentId, driverId);

        return { success: true, message: "Asignación realizada correctamente" };
    } catch (error) {
        console.error("Error al asignar paquete:", error);
        throw error;
    } finally {
        dbConnection.end();
    }
}

export async function desasignar(company, userId, dataQr, deviceFrom) {
    const dbConfig = getProdDbConfig(company);
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    try {
        const isFlex = dataQr.hasOwnProperty("sender_id");

        const shipmentId = isFlex
            ? await idFromFlexShipment(dataQr.id, dbConnection)
            : await idFromLightdataShipment(company, dataQr, dbConnection);

        const sqlOperador = "SELECT operador FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";

        const result = await executeQuery(dbConnection, sqlOperador, [shipmentId]);

        const operador = result.length > 0 ? result[0].operador : 0;

        if (operador == 0) {
            return { success: false, message: "El paquete ya está desasignado" };
        }

        if (!shipmentId) {
            throw new Error("No se pudo obtener el id del envío.");
        }

        const sq = "SELECT estado FROM `envios_historial` WHERE  didEnvio = ? and superado=0 LIMIT 1";
        const estado = await executeQuery(dbConnection, sq, [shipmentId]);
        const insertQuery = "INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)";

        const resultInsertQuery = await executeQuery(dbConnection, insertQuery, ["", 0, shipmentId, estado[0].estado, userId, deviceFrom]);

        // Actualizar asignaciones
        await executeQuery(dbConnection, `UPDATE envios_asignaciones SET superado=1, did=${resultInsertQuery.insertId} WHERE superado=0 AND elim=0 AND didEnvio = ?`, [shipmentId]);

        // Actualizar historial
        await executeQuery(dbConnection, `UPDATE envios_historial SET didCadete=0 WHERE superado=0 AND elim=0 AND didEnvio = ?`, [shipmentId]);

        // Desasignar chofer
        await executeQuery(dbConnection, `UPDATE envios SET choferAsignado = 0 WHERE superado=0 AND elim=0 AND did = ?`, [shipmentId]);

        await updateRedis(company.did, shipmentId, 0);
        return { success: true, message: "Desasignación realizada correctamente" };
    } catch (error) {
        console.error("Error al desasignar paquete:", error);
        throw error;
    } finally {
        dbConnection.end();
    }
}