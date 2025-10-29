import { urlApimovilGetShipmentId, axiosInstance } from "../../../db.js";
import { crearTablaAsignaciones } from "../../functions/crearTablaAsignaciones.js";
import { crearUsuario } from "../../functions/crearUsuario.js";
import { insertAsignacionesDB } from "../../functions/insertAsignacionesDB.js";
import { checkIfFulfillment, getShipmentIdFromQr, LightdataORM } from "lightdata-tools";

export async function asignar({ db, req, company }) {
    const { dataQr, driverId } = req.body;
    const { userId } = req.user;

    const shipmentId = await getShipmentIdFromQr({
        url: urlApimovilGetShipmentId,
        axiosInstance,
        req,
        dataQr,
        desde: "Asignaciones API",
        companyId: req.body.companyId,
    });

    await checkIfFulfillment({
        db,
        mlShipmentId: shipmentId,
    });

    const fetchEnvioPromise = LightdataORM.select({
        dbConnection: db,
        table: "envios",
        where: { did: shipmentId },
        select: ["estado"],
        throwIfNotExists: true,
        throwIfNotExistsMessage: "No se encontró el envío especificado."
    });

    const duplicateCheckPromise =
        company.did !== 4
            ? LightdataORM.select({
                dbConnection: db,
                table: "envios_asignaciones",
                where: { didEnvio: shipmentId, operador: driverId },
                throwIfExists: true,
                throwIfExistsMessage:
                    "El chofer ya tiene una asignación activa para este paquete."
            })
            : Promise.resolve();

    const infraPromise = Promise.all([
        crearTablaAsignaciones(company.did),
        crearUsuario(company.did),
    ]);

    const [envioRows] = await Promise.all([
        fetchEnvioPromise,
        duplicateCheckPromise,
        infraPromise,
    ]);

    const estadoActual = envioRows[0].estado;

    const [didAsignacion] = await LightdataORM.upsert({
        dbConnection: db,
        table: "envios_asignaciones",
        where: { didEnvio: shipmentId },
        data: {
            operador: driverId,
            didEnvio: shipmentId,
            estado: estadoActual,
            desde: "Asignaciones API",
            orden: 0,
            procesada: 0,
        },
        quien: userId
    });

    const updateEnvioPromise = LightdataORM.update({
        dbConnection: db,
        table: "envios",
        data: {
            choferAsignado: driverId,
            costoActualizadoChofer: 0,
        },
        where: { did: shipmentId },
        quien: userId
    });

    const updateParadaPromise =
        company.did !== 4
            ? LightdataORM.update({
                dbConnection: db,
                table: "ruteo_paradas",
                data: { superado: 1 },
                where: { didPaquete: shipmentId },
                quien: userId,
                throwIfNotExists: false
            })
            : Promise.resolve();

    await Promise.all([updateEnvioPromise, updateParadaPromise]);

    await insertAsignacionesDB(
        company.did,
        didAsignacion,
        driverId,
        estadoActual,
        userId,
        "Asignaciones API"
    );

    return {
        success: true,
        message: "Asignación realizada correctamente",
    };
}
