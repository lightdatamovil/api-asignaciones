import { Router } from "express";
import { asignar } from "../controller/assignments/app/assign.js";
import { desasignar } from "../controller/assignments/app/unassign.js";
import { verifyAssignment } from "../controller/assignments/app/verifyAssignment.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { verificarAsignacionWeb } from "../controller/assignments/web/verificarAsignacionWeb.js";
import { asignar_web } from "../controller/assignments/web/assign_web.js";
import { desasignar_web } from "../controller/assignments/web/unassignWeb.js";

const asignaciones = Router();

asignaciones.post(
  '/asignar',
  buildHandlerWrapper({
    required: ["dataQr", "driverId"],
    controller: async ({ db, req, company }) => {
      let result;

      if (company.did == 4) {
        result = await verifyAssignment({ db, req, company });
      } else {
        result = await asignar({ db, req, company });
      }

      return result;
    },
  })
);

asignaciones.post(
  '/desasignar',
  buildHandlerWrapper({
    required: ["dataQr"],
    controller: async ({ db, company }) => await desasignar({ db, company }),
  })
);

asignaciones.post(
  '/asignar-web',
  buildHandlerWrapper({
    required: ["shipmentId", "driverId"],
    controller: async ({ db, req, company }) => {
      let result;

      if (company.did == 4) {
        result = await verificarAsignacionWeb({ db, req, company });
      } else {
        result = await asignar_web({ db, req, company });
      }

      return result;
    },
  })
);

asignaciones.post(
  '/desasignar-web',
  buildHandlerWrapper({
    required: ["dataQr"],
    controller: async ({ db, company, req }) => await desasignar_web({ db, req, company }),
  })
);

export default asignaciones;
