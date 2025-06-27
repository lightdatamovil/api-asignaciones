import {
  executeQuery,
  getProdDbConfig,
  updateRedis,
} from "../../db.js";
import { logCyan } from "../../src/functions/logsCustom.js";
import { crearTablaAsignaciones } from "../functions/crearTablaAsignaciones.js";

import { crearUsuario } from "../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";
import mysql from "mysql";
import CustomException from "../../classes/custom_exception.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";

export async function asignar(
  company,
  userId,
  body,
  driverId,
  deviceFrom
) {
  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql.createConnection(dbConfig);
  dbConnection.connect();

  const dataQr = body.dataQr;

  const shipmentId = await getShipmentIdFromQr(company.did, dataQr);

  const checkIfFFA = `SELECT elim FROM envios WHERE superado=0 AND elim=52 AND did = ?`;
  const ffaRows = await executeQuery(dbConnection, checkIfFFA, [shipmentId]);
  if (ffaRows.length > 0) {
    dbConnection.end();
    throw new CustomException({
      title: "Fulfillment Error",
      message: "El paquete todavia no esta armado, espera a terminar el proceso y vuelva a intentarlo.",
    });
  }

  const sqlAsignado = `SELECT id, estado FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ? AND operador = ?`;
  const asignadoRows = await executeQuery(dbConnection, sqlAsignado, [
    shipmentId,
    driverId,
  ]);

  if (asignadoRows.length > 0) {
    dbConnection.end();
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
    dbConnection.end();
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

  await insertAsignacionesDB(
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

  dbConnection.end();
  return resultado;

}

export async function desasignar(company, userId, body, deviceFrom) {
  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql.createConnection(dbConfig);
  dbConnection.connect();

  const dataQr = body.dataQr;

  const shipmentId = await getShipmentIdFromQr(company.did, dataQr);

  const sqlOperador =
    "SELECT operador, estado FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";
  const result = await executeQuery(dbConnection, sqlOperador, [shipmentId]);

  const operador = result.length > 0 ? result[0].operador : 0;

  if (operador == 0) {
    dbConnection.end();
    return {
      feature: "asignacion",
      success: false,
      message: "El paquete ya está desasignado.",
    };
  }
  logCyan("El paquete está asignado");

  if (!shipmentId) {
    dbConnection.end();

    return {
      feature: "asignacion",
      success: false,
      message: "Error al obtener el id del envio",
    };
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

  await insertAsignacionesDB(
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

  dbConnection.end();
  return resultado;
}
