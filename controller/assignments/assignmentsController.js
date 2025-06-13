import {
  executeQuery,
  getDbConfig,
  getProdDbConfig,
  updateRedis,
} from "../../db.js";
import { logCyan, logRed } from "../../src/functions/logsCustom.js";
import { crearTablaAsignaciones } from "../functions/crearTablaAsignaciones.js";

import { crearUsuario } from "../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";
import { idFromFlexShipment } from "../functions/idFromFlexShipment.js";
import { idFromNoFlexShipment } from "../functions/idFromNoFlexShipment.js";
import mysql from "mysql";
import { crearLog } from "../../src/functions/createLog.js";

export async function asignar(
  company,
  userId,
  body,
  driverId,
  deviceFrom,
  startTime
) {
  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql.createConnection(dbConfig);
  dbConnection.connect();

  const dbConfigLocal = getDbConfig();
  const dbConnectionLocal = mysql.createConnection(dbConfigLocal);
  dbConnectionLocal.connect();

  try {
    const dataQr = body.dataQr;
    const isFlex = Object.prototype.hasOwnProperty.call(dataQr, "sender_id");
    if (isFlex) {
      logCyan("Es Flex");
    } else {
      logCyan("No es Flex");
    }

    const shipmentId = isFlex
      ? await idFromFlexShipment(dataQr.id, dbConnection)
      : await idFromNoFlexShipment(company, dataQr, dbConnection);

    const sqlAsignado = `SELECT id, estado FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ? AND operador = ?`;
    const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [
      shipmentId,
      driverId,
    ]);

    if (asignadoRows.length > 0) {
      crearLog(
        dbConnectionLocal,
        company.did,
        userId,
        body.profile,
        body,
        (performance.now() - startTime).toFixed(2),
        "El paquete ya se encuentra asignado a este chofer.",
        "asignar",
        "api",
        true
      );
      return {
        feature: "asignacion",
        success: false,
        message: "El paquete ya se encuentra asignado a este chofer.",
      };
    }
    logCyan("El paquete todavia no está asignado");

    const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim=0 AND didEnvio = ?`;
    const estadoRows = await executeQuery(dbConnection, estadoQuery, [
      shipmentId,
    ]);
    logCyan("Obtengo el estado del paquete");

    if (estadoRows.length === 0) {
      throw new Error("No se pudo obtener el estado del paquete.");
    }

    const estado = estadoRows[0].estado;

    await crearTablaAsignaciones(dbConnectionLocal, company.did);
    logCyan("Creo la tabla de asignaciones");

    await crearUsuario(dbConnectionLocal, company.did);
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
      {
        sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim=0 AND id = ?`,
        values: [did, did],
      },
      {
        sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim=0 AND didEnvio = ? AND did != ?`,
        values: [shipmentId, did],
      },
      {
        sql: `UPDATE envios SET choferAsignado = ? WHERE superado=0 AND elim=0 AND did = ?`,
        values: [driverId, shipmentId],
      },
      {
        sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim=0 AND didPaquete = ?`,
        values: [shipmentId],
      },
      {
        sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim=0 AND didEnvio = ?`,
        values: [driverId, shipmentId],
      },
      {
        sql: `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim=0 AND did = ?`,
        values: [shipmentId],
      },
    ];

    for (const { sql, values } of queries) {
      await executeQuery(dbConnection, sql, values);
    }
    logCyan("Updateo las tablas");

    await insertAsignacionesDB(dbConnectionLocal,
      company.did,
      did,
      driverId,
      estado,
      userId,
      deviceFrom
    );
    logCyan("Inserto en la base de datos individual de asignaciones");

    await updateRedis(company.did, shipmentId, driverId);
    logCyan("Actualizo Redis con la asignación");

    const resultado = {
      feature: "asignacion",
      success: true,
      message: "Asignación realizada correctamente",
    };

    const sendDuration = performance.now() - startTime;

    crearLog(
      dbConnectionLocal,
      company.did,
      userId,
      body.profile,
      body,
      sendDuration.toFixed(2),
      JSON.stringify(resultado),
      "asignar",
      "api",
      true
    );

    return resultado;
  } catch (error) {
    const sendDuration = performance.now() - startTime;
    crearLog(
      dbConnectionLocal,
      company.did,
      userId,
      body.profile,
      body,
      sendDuration.toFixed(2),
      error.stack,
      "asignar",
      "api",
      false
    );
    logRed(`Error al asignar paquete:  ${error.stack}`);
    throw error;
  } finally {
    dbConnection.end();
  }
}

export async function desasignar(company, userId, body, deviceFrom, startTime) {
  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql.createConnection(dbConfig);
  dbConnection.connect();

  const dbConfigLocal = getDbConfig();
  const dbConnectionLocal = mysql.createConnection(dbConfigLocal);
  dbConnectionLocal.connect();

  try {
    const dataQr = body.dataQr;

    const isFlex = Object.prototype.hasOwnProperty.call(dataQr, "sender_id");

    if (isFlex) {
      logCyan("Es Flex");
    } else {
      logCyan("No es Flex");
    }
    const shipmentId = isFlex
      ? await idFromFlexShipment(dataQr.id, dbConnection)
      : await idFromNoFlexShipment(company, dataQr, dbConnection);

    const sqlOperador =
      "SELECT operador, estado FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, sqlOperador, [shipmentId]);

    const operador = result.length > 0 ? result[0].operador : 0;

    if (operador == 0) {
      crearLog(
        dbConnectionLocal,
        company.did,
        userId,
        body.profile,
        body,
        (performance.now() - startTime).toFixed(2),
        "El paquete ya está desasignado",
        "desasignar",
        "api",
        true
      );
      return {
        feature: "asignacion",
        success: false,
        message: "El paquete ya está desasignado",
      };
    }
    logCyan("El paquete está asignado");

    if (!shipmentId) {
      throw new Error("No se pudo obtener el id del envío.");
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
      `UPDATE envios_asignaciones SET superado=1, did=${resultInsertQuery.insertId} WHERE superado=0 AND elim=0 AND didEnvio = ?`,
      [shipmentId]
    );

    // Actualizar historial
    await executeQuery(
      dbConnection,
      `UPDATE envios_historial SET didCadete=0 WHERE superado=0 AND elim=0 AND didEnvio = ?`,
      [shipmentId]
    );

    // Desasignar chofer
    await executeQuery(
      dbConnection,
      `UPDATE envios SET choferAsignado = 0 WHERE superado=0 AND elim=0 AND did = ?`,
      [shipmentId]
    );

    logCyan("Updateo las tablas");

    await insertAsignacionesDB(dbConnectionLocal,
      company.did,
      shipmentId,
      0,
      result[0].estado,
      userId,
      deviceFrom
    );
    logCyan("Inserto en la base de datos individual de asignaciones");

    await updateRedis(company.did, shipmentId, 0);
    logCyan("Updateo redis con la desasignación");

    const resultado = {
      feature: "asignacion",
      success: true,
      message: "Desasignación realizada correctamente",
    };

    const sendDuration = performance.now() - startTime;

    crearLog(
      dbConnectionLocal,
      company.did,
      userId,
      body.profile,
      body,
      sendDuration.toFixed(2),
      JSON.stringify(resultado),
      "desasignar",
      "api",
      true
    );

    return resultado;
  } catch (error) {
    const sendDuration = performance.now() - startTime;
    crearLog(
      dbConnectionLocal,
      company.did,
      userId,
      body.profile,
      body,
      sendDuration.toFixed(2),
      error.stack,
      "desasignar",
      "api",
      false
    );
    logRed(`Error al desasignar paquete:  ${error.stack}`);
    throw error;
  } finally {
    dbConnection.end();
  }
}
