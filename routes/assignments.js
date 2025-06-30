import { Router } from "express";
import {
  asignar,
  desasignar,
} from "../controller/assignments/assignmentsController.js";
import { verifyParameters } from "../src/functions/verifyParameters.js";
import { getCompanyById, getProdDbConfig } from "../db.js";
import { verificacionDeAsignacion } from "../controller/assignmentsProCourrier/assignmentsProcourrierController.js";
import { logPurple, logRed } from "../src/functions/logsCustom.js";
import { crearLog } from "../src/functions/createLog.js";
import CustomException from "../classes/custom_exception.js";
import mysql2 from "mysql2";

const asignaciones = Router();

asignaciones.post("/asignar", async (req, res) => {
  const startTime = performance.now();
  const errorMessage = verifyParameters(req.body, [
    "dataQr",
    "driverId",
    "deviceFrom",
  ]);

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { companyId, userId, dataQr, driverId, deviceFrom, profile } = req.body;

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
      result = await verificacionDeAsignacion(
        dbConnection,
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
        dbConnection,
        company,
        userId,
        req.body,
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

export default asignaciones;
