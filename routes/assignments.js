import { Router } from "express";
import { verifyParameters } from "../src/functions/verifyParameters.js";
import { getCompanyById, getProdDbConfig } from "../db.js";
import { logPurple, logRed } from "../src/functions/logsCustom.js";
import { crearLog } from "../src/functions/createLog.js";
import CustomException from "../clases/custom_exception.js";
import mysql2 from "mysql2";
import { asignar } from "../controller/assignments/assign.js";
import { desasignar } from "../controller/assignments/unassign.js";
import { verifyAssignment } from "../controller/assignments/verifyAssignment.js";
import { asignar_web } from "../controller/assignments/assign_web.js";
import { verificarAsignacionWeb } from "../controller/assignments/verificarAsignacionWeb.js";
import { desasignar_web } from "../controller/assignments/unassignWeb.js";
import { Status } from "../clases/status.js";
import { handleError } from "../src/functions/handle_error.js";
import { verificarTodo } from "../src/functions/verificar_todo.js";

const asignaciones = Router();

const requiredParams = ["dataQr",
  "driverId",
  "deviceFrom",
  "companyId",
  "userId",
  "dataQr",
  "driverId",
  "deviceFrom",
  "profile"]


asignaciones.post("/asignar", async (req, res) => {
  const start = performance.now();
  if (!verificarTodo(req, res, ['id'], requiredParams)) return;

  try {
    const { companyId, userId } = req.body;

    if (companyId == 12 && userId == 49) {
      return res.status(Status.conflict).json({ message: "Comunicarse con la logística." });
    }

    if (company.did == 4) {
      let result = await verifyAssignment(
        company,
        userId,
        profile,
        dataQr,
        driverId,
        deviceFrom,
        req.body
      );
    } else {
      result = await asignar(
        company,
        userId,
        dataQr,
        driverId,
        deviceFrom,
        startTime
      );
    }
  } catch (error) {
    return handleError(req, res, error);
  } finally {
    logPurple(`POST /api/estados-ticket ejecutado en ${performance.now() - start} ms`);
  }
});


asignaciones.post("/desasignar", async (req, res) => {
  const startTime = performance.now();
  const errorMessage = verifyParameters(req.body, ["dataQr", "deviceFrom"]);

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { companyId, userId, profile, deviceFrom } = req.body;

  if (companyId == 12 && userId == 49) {
    return res.status(400).json({ message: "Comunicarse con la logística." });
  }

  const company = await getCompanyById(companyId);

  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql2.createConnection(dbConfig);
  dbConnection.connect();

  try {

    const result = await desasignar(
      dbConnection,
      company,
      userId,
      req.body,
      deviceFrom
    );

    crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(result), "/desasignar", "api", true);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CustomException) {
      logRed(`Error 400 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/desasignar", "api", false);
      res.status(400).json(error);
    } else {
      logRed(`Error 500 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/desasignar", "api", false);
      res.status(500).json({ title: 'Error interno del servidor', message: 'Unhandled Error', stack: error.stack });
    }
  } finally {
    dbConnection.end();
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
  }
});

asignaciones.post("/asignar-web", async (req, res) => {
  const startTime = performance.now();
  const errorMessage = verifyParameters(req.body, [
    "shipmentId",
    "deviceFrom",
  ]);

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { companyId, userId, shipmentId, driverId, deviceFrom, profile } = req.body;

  if (companyId == 12 && userId == 49) {
    return res.status(400).json({ message: "Comunicarse con la logística." });
  }

  const company = await getCompanyById(companyId);

  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql2.createConnection(dbConfig);
  dbConnection.connect();

  try {
    let result;

    if (company.did == 4) {

      result = await verificarAsignacionWeb(
        dbConnection,
        company,
        userId,
        profile,
        shipmentId,
        driverId,
        deviceFrom,
        req.body
      );
    } else {
      result = await asignar_web(
        dbConnection,
        company,
        userId,
        shipmentId,
        driverId,
        deviceFrom,
        startTime
      );
    }

    crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(result), "/asignar", "api", true);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CustomException) {
      logRed(`Error 400 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/asignar", "api", false);
      res.status(400).json(error);
    } else {
      logRed(`Error 500 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/asignar", "api", false);
      res.status(500).json({ title: 'Error interno del servidor', message: 'Unhandled Error', stack: error.stack });
    }
  } finally {
    dbConnection.end();
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
  }
});

asignaciones.post("/desasignar-web", async (req, res) => {
  const startTime = performance.now();
  const errorMessage = verifyParameters(req.body, ["shipmentId", "deviceFrom"]);

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { companyId, userId, profile, deviceFrom, shipmentId } = req.body;

  if (companyId == 12 && userId == 49) {
    return res.status(400).json({ message: "Comunicarse con la logística." });
  }

  const company = await getCompanyById(companyId);

  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql2.createConnection(dbConfig);
  dbConnection.connect();


  try {

    const result = await desasignar_web(
      dbConnection,
      company,
      userId,
      shipmentId,
      deviceFrom
    );

    crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(result), "/desasignar", "api", true);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CustomException) {
      logRed(`Error 400 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/desasignar", "api", false);
      res.status(400).json(error);
    } else {
      logRed(`Error 500 en asignaciones: ${error} `);
      crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(error), "/desasignar", "api", false);
      res.status(500).json({ title: 'Error interno del servidor', message: 'Unhandled Error', stack: error.stack });
    }
  } finally {
    dbConnection.end();
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
  }
});



export default asignaciones;
