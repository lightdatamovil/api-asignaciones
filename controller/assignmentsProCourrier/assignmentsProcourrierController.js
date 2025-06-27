import { executeQuery, updateRedis, } from "../../db.js";
import { logCyan } from "../../src/functions/logsCustom.js";
import { crearTablaAsignaciones } from "../functions/crearTablaAsignaciones.js";
import { crearUsuario } from "../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";
import CustomException from "../../classes/custom_exception.js";
import { getShipmentIdFromQr } from "../../src/functions/getShipmentIdFromQr.js";

export async function verificacionDeAsignacion(
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

async function asignar(dbConnection, company, userId, driverId, deviceFrom, shipmentId) {

  const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim=0 AND didEnvio = ?`;
  const estadoRows = await executeQuery(dbConnection, estadoQuery, [shipmentId]);

  if (estadoRows.length === 0) {
    throw new CustomException({
      title: "No se pudo obtener el estado del paquete.",
      message: "El paquete no tiene un estado definido."
    });
  }
  logCyan("Obtengo el estado del paquete");

  const estado = estadoRows[0].estado;

  await crearTablaAsignaciones(company.did);
  logCyan("Creo la tabla de asignaciones");

  await crearUsuario(company.did);
  logCyan("Creo la tabla de usuarios");

  const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await executeQuery(dbConnection, insertSql, ["", driverId, shipmentId, estado, userId, deviceFrom]);
  logCyan("Inserto en la tabla de asignaciones");

  const did = result.insertId;

  const queries = [
    { sql: `UPDATE envios_asignaciones SET did = ? WHERE superado=0 AND elim=0 AND id = ?`, values: [did, did] },
    { sql: `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim=0 AND didEnvio = ? AND did != ?`, values: [shipmentId, did] },
    { sql: `UPDATE envios SET choferAsignado = ?, costoActualizadoChofer = 0 WHERE superado=0 AND elim=0 AND did = ?`, values: [driverId, shipmentId] },
    { sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim=0 AND didPaquete = ?`, values: [shipmentId] },
    { sql: `UPDATE envios_historial SET didCadete = ? WHERE superado=0 AND elim=0 AND didEnvio = ?`, values: [driverId, shipmentId] },
  ];

  for (const { sql, values } of queries) {
    await executeQuery(dbConnection, sql, values);
  }
  logCyan("Updateo las tablas");

  await insertAsignacionesDB(company.did, did, driverId, estado, userId, deviceFrom);
  logCyan("Inserto en la base de datos individual de asignaciones");
  const resultado = {
    success: true,
    message: "Asignación realizada correctamente",
  };

  return resultado;
}

export async function desasignar(dbConnection, company, userId, body, deviceFrom) {

  const dataQr = body.dataQr;

  const isFlex = Object.prototype.hasOwnProperty.call(dataQr, "sender_id");

  if (isFlex) {
    logCyan("Es Flex");
  } else {
    logCyan("No es Flex");
  }

  const shipmentId = await getShipmentIdFromQr(company.did, dataQr);

  const sqlOperador =
    "SELECT operador FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";
  const result = await executeQuery(dbConnection, sqlOperador, [shipmentId]);

  const operador = result.length > 0 ? result[0].operador : 0;

  if (operador == 0) {
    return {
      estadoRespuesta: false,
      mensaje: "El paquete ya está desasignado",
    };
  }
  logCyan("El paquete está asignado");

  if (!shipmentId) {
    throw new CustomException({
      title: "No se pudo obtener el id del envío.",
      message: "El QR no contiene un id de envío válido."
    });
  }

  const setEstadoAsignacion =
    "UPDATE envios SET estadoAsignacion = 0 WHERE superado = 0 AND elim=0 AND did = ?";
  await executeQuery(dbConnection, setEstadoAsignacion, [shipmentId]);

  const sq =
    "SELECT estado FROM `envios_historial` WHERE  didEnvio = ? and superado = 0 LIMIT 1";
  const estado = await executeQuery(dbConnection, sq, [shipmentId]);

  const insertQuery =
    "INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)";
  const resultInsertQuery = await executeQuery(dbConnection, insertQuery, [
    "",
    0,
    shipmentId,
    estado[0].estado,
    userId,
    deviceFrom,
  ]);
  logCyan("Inserto en la tabla de asignaciones con el operador 0");
  // Actualizar asignaciones
  await executeQuery(
    dbConnection,
    `UPDATE envios_asignaciones SET superado = 1 WHERE superado = 0 AND elim=0 AND didEnvio = ? AND did != ${resultInsertQuery.insertId}`,
    [shipmentId]
  );

  // Actualizar historial
  await executeQuery(
    dbConnection,
    `UPDATE envios_historial SET didCadete=0 WHERE superado = 0 AND elim=0 AND didEnvio = ?`,
    [shipmentId]
  );

  // Desasignar chofer
  await executeQuery(
    dbConnection,
    `UPDATE envios SET choferAsignado = 0 WHERE superado = 0 AND elim=0 AND did = ?`,
    [shipmentId]
  );
  logCyan("Updateo las tablas");

  await updateRedis(company.did, shipmentId, 0);
  logCyan("Updateo redis con la desasignación");

  await insertAsignacionesDB(
    company.did,
    shipmentId,
    0,
    estado[0].estado,
    userId,
    deviceFrom
  );
  logCyan("Inserto en la base de datos individual de asignaciones");

  const resultado = {
    success: true,
    message: "desasignación realizada correctamente",
  };

  return resultado;
}
