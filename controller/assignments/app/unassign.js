import { urlApimovil } from "../../../db.js";
import { insertAsignacionesDB } from "../../functions/insertAsignacionesDB.js";
import { getShipmentIdFromQr, LightdataORM } from "lightdata-tools";

export async function desasignar({ db, req, company }) {
    const { dataQr } = req.body;
    const { userId } = req.user;

    const shipmentId = await getShipmentIdFromQr({
        headers: req.headers,
        url: urlApimovil,
        dataQr,
        desde: "Asignaciones API",
    });

    if (!shipmentId) {
        return {
            feature: "asignacion",
            success: false,
            message: "Error al obtener el id del envío",
        };
    }

    const [asignacionRow] = await LightdataORM.select({
        dbConnection: db,
        table: "envios_asignaciones",
        where: { didEnvio: shipmentId },
        select: ["operador", "estado"],
        throwIfNotExists: true,
        throwIfNotExistsMessage:
            "No se encontró una asignación activa para este envío.",
    });

    const operadorActual = asignacionRow.operador ?? 0;
    const estadoActual = asignacionRow.estado ?? 0;

    if (Number(operadorActual) === 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "El paquete ya está desasignado.",
        };
    }

    const updateEnvioPromise =
        company.did === 4
            ? LightdataORM.update({
                dbConnection: db,
                table: "envios",
                data: {
                    estadoAsignacion: 0,
                    choferAsignado: 0,
                },
                where: { did: shipmentId },
                quien: userId,
            })
            : LightdataORM.update({
                dbConnection: db,
                table: "envios",
                data: {
                    choferAsignado: 0,
                },
                where: { did: shipmentId },
                quien: userId,
            });

    const updateAsignacionPromise = LightdataORM.update({
        dbConnection: db,
        table: "envios_asignaciones",
        data: { operador: 0 },
        where: { didEnvio: shipmentId },
        quien: userId,
    });

    await Promise.all([updateEnvioPromise, updateAsignacionPromise]);

    await insertAsignacionesDB(
        company.did,
        shipmentId,
        0,
        estadoActual,
        userId,
        "Asignaciones API"
    );

    return {
        feature: "asignacion",
        success: true,
        message: "Desasignación realizada correctamente",
        shipmentId,
        choferAnterior: operadorActual,
    };
}
