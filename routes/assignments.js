import { Router } from "express";
import { asignar } from "../controller/assignments/app/assign.js";
import { desasignar } from "../controller/assignments/app/unassign.js";
import { verifyAssignment } from "../controller/assignments/app/verifyAssignment.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { verificarAsignacionWeb } from "../controller/assignments/web/verificarAsignacionWeb.js";
import { asignar_web } from "../controller/assignments/web/assign_web.js";
import { desasignar_web } from "../controller/assignments/web/unassignWeb.js";
import { companiesService } from "../db.js";

const asignaciones = Router();

asignaciones.post(
  '/asignar',
  buildHandlerWrapper({
    required: ['dataQr', 'driverId'],
    optional: ['companyId'],
    companyResolver2: async ({ req }) => {
      let companyId = req.body.companyId || req.user.companyId;
      const company = await companiesService.getById(companyId);
      return company;
    },
    controller: async ({ db, req, company }) => {
      let precheck = null;

      if (company.did == 4) {
        precheck = await verifyAssignment({ db, req, company });

        if (!precheck?.proceed) {
          return {
            success: false,
            message: precheck?.message || 'No se pudo verificar la asignación.',
          };
        }
      }

      const result = await asignar({ db, req, company });

      return result;
    },
  })
);

asignaciones.post(
  '/desasignar',
  buildHandlerWrapper({
    required: ["dataQr"],
    optional: ['companyId'],
    companyResolver2: async ({ req }) => {
      const companyId = req.body?.companyId ?? req.user?.companyId;
      const company = await companiesService.getById(companyId);
      return company;
    },
    controller: async ({ db, company, req }) => await desasignar({ db, req, company }),
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
