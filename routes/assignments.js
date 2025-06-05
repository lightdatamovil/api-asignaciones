import { Router } from "express";
import {
  asignar,
  desasignar,
} from "../controller/assignments/assignmentsController.js";
import { verifyParameters } from "../src/functions/verifyParameters.js";
import { getCompanyById } from "../db.js";
import { verificacionDeAsignacion } from "../controller/assignmentsProCourrier/assignmentsProcourrierController.js";

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

  const { companyId, userId, dataQr, driverId, deviceFrom } = req.body;

  if (companyId == 12 && userId == 49) {
    return res.status(200).json({ message: "Comunicarse con la logística." });
  }

  try {
    const company = await getCompanyById(companyId);
    console.log(dataQr, "dataQr");
    let result = null;
    if (company.did == 4) {
      result = await verificacionDeAsignacion(
        company,
        userId,
        profile,
        JSON.parse(dataQr),
        driverId,
        deviceFrom,
        body
      );
    } else {
      result = await asignar(
        company,
        userId,
        req.body,
        driverId,
        deviceFrom,
        startTime
      );
    }


    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.stack });
  }
});

asignaciones.post("/desasignar", async (req, res) => {
  const startTime = performance.now();
  const errorMessage = verifyParameters(req.body, ["dataQr", "deviceFrom"]);

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  const { companyId, userId, deviceFrom } = req.body;

  if (companyId == 12 && userId == 49) {
    return res.status(200).json({ message: "Comunicarse con la logística." });
  }

  try {
    const company = await getCompanyById(companyId);

    const result = await desasignar(
      company,
      userId,
      req.body,
      deviceFrom,
      startTime
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.stack });
  }
});

export default asignaciones;
