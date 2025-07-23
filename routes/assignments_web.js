import { Router } from "express";
import { getCompanyById, getProdDbConfig } from "../db.js";
import { logPurple } from "../src/functions/logsCustom.js";
import { crearLog } from "../src/functions/createLog.js";
import mysql2 from "mysql2";
import { verificarAsignacionWeb } from "../controller/assignments/verificarAsignacionWeb.js";
import { asignar_web } from "../controller/assignments/assign_web.js";
import { handleError } from "../src/functions/handle_error.js";
import { desasignar_web } from "../controller/assignments/unassignWeb.js";
import { verificarTodo } from "../src/functions/verificarAll.js";
import { Status } from "../classes/status.js";


const asignaciones_web = Router();

asignaciones_web.post("/asignar-web", async (req, res) => {
    const startTime = performance.now();
    const requiredBodyFields = ["shipmentId", "driverId", "deviceFrom", "profile"];
    if (!verificarTodo(req, res, requiredBodyFields)) return;

    const { companyId, userId, shipmentId, driverId, deviceFrom, profile } = req.body;

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
        res.status(Status.ok).json(result);
    } catch (error) {
        handleError(req, res, error);
    } finally {
        dbConnection.end();
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    }
});


asignaciones_web.post("/desasignar-web", async (req, res) => {
    const startTime = performance.now();
    const requiredBodyFields = ["shipmentId", "deviceFrom"];

    if (!verificarTodo(req, res, requiredBodyFields)) return;

    const { companyId, userId, profile, deviceFrom, shipmentId } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
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
        res.status(Status.ok).json(result);
    } catch (error) {
        handleError(req, res, error);
    } finally {
        dbConnection.end();
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    }
});

export default asignaciones_web;