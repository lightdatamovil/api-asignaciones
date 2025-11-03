import { getShipmentIdFromQr, LightdataORM } from 'lightdata-tools';
import { urlApimovilGetShipmentId, axiosInstance } from '../../../db.js';

/**
 * Verifica reglas de asignación y, si corresponde, actualiza estadoAsignacion.
 * NO llama a `asignar`. Devuelve { proceed: boolean, success: boolean, message?: string, tipo_mensaje?: number }.
 */
export async function verifyAssignment({ db, req }) {
    const { dataQr, driverId } = req.body;
    const { userId, profile } = req.user;

    const shipmentId = await getShipmentIdFromQr({
        url: urlApimovilGetShipmentId,
        axiosInstance,
        req,
        dataQr,
    });

    const [envio] = await LightdataORM.select({
        dbConnection: db,
        table: 'envios',
        where: { did: shipmentId },
    });

    if (!envio) {
        return {
            proceed: false,
            message: 'No se encontró el paquete',
        };
    }

    const driverIdNum = Number(driverId);
    const didCadete = Number(envio.choferAsignado ?? 0);
    const estadoAsignacion = Number(envio.estadoAsignacion ?? 0);
    const esElMismoCadete = didCadete === driverIdNum;

    if (!didCadete) {
        return {
            proceed: true,
        };
    }

    const errorCases = [
        {
            condition: esElMismoCadete && profile === 1 && estadoAsignacion === 1,
            log: 'Es el mismo cadete, es perfil 1 y estadoAsignacion 1',
            message: 'Este paquete ya fue asignado a este cadete',
        },
        {
            condition: esElMismoCadete && profile === 3 && estadoAsignacion === 2,
            log: 'Es el mismo cadete, es perfil 3 y estadoAsignacion 2',
            message: 'Este paquete ya fue autoasignado a este cadete',
        },
        {
            condition: esElMismoCadete && profile === 5 && [3, 4, 5].includes(estadoAsignacion),
            log: 'Es el mismo cadete, es perfil 5 y estadoAsignacion 3, 4 o 5',
            message: 'Este paquete ya fue confirmado a este cadete',
        },
        {
            condition: !esElMismoCadete && profile === 1 && estadoAsignacion === 1,
            log: 'Es perfil 1 y estadoAsignacion 1',
            message: 'Este paquete ya fue asignado a otro cadete',
            tipo_mensaje: 1,
        },
        {
            condition: !esElMismoCadete && profile === 3 && [1, 2, 3, 4, 5].includes(estadoAsignacion),
            log: 'Es perfil 3 y estadoAsignacion ' + estadoAsignacion,
            message: 'No tenes el paquete asignado',
            tipo_mensaje: 2,
        },
        {
            condition: !esElMismoCadete && profile === 5 && [1, 3, 4, 5].includes(estadoAsignacion),
            log: 'Es perfil 5 y estadoAsignacion 1, 3, 4 o 5',
            message: 'Este paquete ya fue confirmado a otro cadete',
            tipo_mensaje: 3,
        },
    ];

    for (const err of errorCases) {
        if (err.condition) {
            if (err.tipo_mensaje) {
                await LightdataORM.insert({
                    dbConnection: db,
                    table: 'asignaciones_fallidas',
                    data: {
                        operador: userId,
                        didEnvio: shipmentId,
                        quien: driverIdNum,
                        tipo_mensaje: err.tipo_mensaje,
                        desde: 'Asignacion API',
                    },
                    quien: userId,
                });
            }
            return {
                proceed: false,
                message: err.message,
            };
        }
    }

    const transitions = [
        {
            condition: profile === 1 && estadoAsignacion === 0,
            updateState: 1,
            message: 'Asignado correctamente.',
            log: 'Puse en estado 1',
        },
        {
            condition: profile === 3 && estadoAsignacion === 1 && esElMismoCadete,
            updateState: 2,
            message: 'Autoasignado correctamente.',
            log: 'Puse en estado 2',
        },
        {
            condition: profile === 5 && estadoAsignacion === 2 && esElMismoCadete,
            updateState: 3,
            message: 'Confirmado correctamente.',
            log: 'Puse en estado 3',
        },
        {
            condition: profile === 5 && estadoAsignacion === 1 && esElMismoCadete,
            updateState: 4,
            message: 'Confirmado correctamente.',
            log: 'Puse en estado 4',
        },
        {
            condition: profile === 5 && estadoAsignacion === 0,
            updateState: 5,
            message: 'Asignado correctamente.',
            log: 'Puse en estado 5',
        },
    ];

    const transition = transitions.find((t) => t.condition);

    if (!transition) {
        return {
            proceed: false,
            message: 'No se puede asignar el paquete.',
        };
    }

    await LightdataORM.update({
        dbConnection: db,
        table: 'envios',
        data: { estadoAsignacion: transition.updateState },
        where: { did: shipmentId },
        quien: userId,
    });

    return {
        proceed: true,
    };
}
