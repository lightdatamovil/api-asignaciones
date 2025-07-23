import { Router } from "express";
import { getCompanyById, getProdDbConfig } from "../db.js";
import { logPurple } from "../src/functions/logsCustom.js";
import { crearLog } from "../src/functions/createLog.js";
import mysql2 from "mysql2";
import { asignar } from "../controller/assignments/assign.js";
import { desasignar } from "../controller/assignments/unassign.js";
import { verifyAssignment } from "../controller/assignments/verifyAssignment.js";
import { handleError } from "../src/functions/handle_error.js";
import { verificarTodo } from "../src/functions/verificarAll.js";
import { Status } from "../classes/status.js";

const asignaciones = Router();

asignaciones.post("/asignar", async (req, res) => {
  const startTime = performance.now();
  const requiredBodyFields = ["dataQr", "driverId", "deviceFrom"];
  if (!verificarTodo(req, res, [], requiredBodyFields)) return;

  const { companyId, userId, dataQr, driverId, deviceFrom, profile } = req.body;
  if (companyId == 12 && userId == 49) {
    return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
  }

  const company = await getCompanyById(companyId);

  const dbConfig = getProdDbConfig(company);
  const dbConnection = mysql2.createConnection(dbConfig);
  dbConnection.connect();

  try {
    let result;

    if (company.did == 4) {
      result = await verifyAssignment(
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
        dataQr,
        driverId,
        deviceFrom,
        startTime
      );
    }

    crearLog(companyId, userId, profile, req.body, performance.now() - startTime, JSON.stringify(result), "/asignar", "api", true);
    res.status(Status.ok).json(result);
  } catch (error) {
    handleError(req, res, error);
  } finally {
    dbConnection.end();
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
  }
});

asignaciones.post("/desasignar", async (req, res) => {
  const startTime = performance.now();
  const requiredBodyFields = ["dataQr", "deviceFrom"];
  if (!verificarTodo(req, res, [], requiredBodyFields)) return;

  const { companyId, userId, profile, deviceFrom } = req.body;
  if (companyId == 12 && userId == 49) {
    return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
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
    res.status(Status.ok).json(result);
  } catch (error) {
    handleError(req, res, error);
  } finally {
    dbConnection.end();
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
  }
});


export default asignaciones;
