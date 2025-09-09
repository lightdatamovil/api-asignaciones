import { Router } from "express";
import { asignar } from "../controller/assignments/app/assign.js";
import { desasignar } from "../controller/assignments/app/unassign.js";
import { verifyAssignment } from "../controller/assignments/app/verifyAssignment.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { verificarAsignacionWeb } from "../controller/assignments/web/verificarAsignacionWeb.js";
import { asignar_web } from "../controller/assignments/web/assign_web.js";
import { desasignar_web } from "../controller/assignments/web/unassignWeb.js";
import { Status } from "lightdata-tools";

const asignaciones = Router();

asignaciones.post(
  '/asignar',
  buildHandlerWrapper({
    required: ["dataQr", "driverId"],
    controller: async ({ db, res, req, company }) => {
      const { companyId, userId } = req.user;
      let result;
      if (companyId == 12 && userId == 49) {
        return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
      }
      if (company.did == 4) {
        result = await verifyAssignment(db, req, company);
      } else {
        result = await asignar(db, req, company);
      }
      return result;
    },
  })
);

asignaciones.post(
  '/desasignar',
  buildHandlerWrapper({
    required: ["dataQr"],
    controller: async ({ db, company, res, req }) => {
      const { companyId, userId } = req.user;

      if (companyId == 12 && userId == 49) {
        return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
      }
      const result = await desasignar(db, company);
      return result;
    },
  })
);


asignaciones.post(
  '/asignar-web',
  buildHandlerWrapper({
    required: ["shipmentId", "driverId"],
    controller: async ({ db, res, req, company }) => {
      const { companyId, userId } = req.user;
      let result;
      if (companyId == 12 && userId == 49) {
        return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
      }
      if (company.did == 4) {

        result = await verificarAsignacionWeb(db, req, company);
      } else {
        result = await asignar_web(db, req, company);
      }
      return result;
    },
  })
);

asignaciones.post(
  '/desasignar',
  buildHandlerWrapper({
    required: ["dataQr"],
    controller: async ({ db, company, res, req }) => {
      const { companyId, userId } = req.user;

      if (companyId == 12 && userId == 49) {
        return res.status(Status.badRequest).json({ message: "Comunicarse con la logística." });
      }
      const result = await desasignar_web(db, req, company);
      return result;
    },
  })
);


export default asignaciones;
