import axios from "axios";
import { logBlue, logRed } from "./logsCustom.js";
import CustomException from "../../classes/custom_exception.js";

export async function getShipmentIdFromQr(companyId, dataQr) {
    const startTime = performance.now();

    const payload = {
        companyId: Number(companyId),
        userId: 0,
        profile: 0,
        deviceId: "null",
        brand: "null",
        model: "null",
        androidVersion: "null",
        deviceFrom: "getShipmentIdFromQr de Asignacion API",
        appVersion: "null",
        dataQr: dataQr,
    };

    logBlue(`[getShipmentIdFromQr] Inicio: ${performance.now() - startTime} ms`);

    let result;
    try {
        const beforeRequest = performance.now();
        result = await axios.post("https://apimovil2.lightdata.app/api/qr/get-shipment-id", payload);
        const afterRequest = performance.now();
        logBlue(`[getShipmentIdFromQr] Request completada en ${(afterRequest - beforeRequest).toFixed(2)} ms`);
    } catch (error) {
        logRed(`[getShipmentIdFromQr] Error durante request: ${(performance.now() - startTime).toFixed(2)} ms`);
        throw new CustomException({
            title: "Error al obtener el shipmentId",
            message: "No se pudo obtener el id del envío desde el QR.",
        });
    }

    const afterResponse = performance.now();

    if (result.status === 200) {
        if (
            Object.prototype.hasOwnProperty.call(result.data.body, "success") &&
            result.data.body.success === false
        ) {
            logRed(`[getShipmentIdFromQr] Respuesta inválida en ${(afterResponse - startTime).toFixed(2)} ms`);
            throw new CustomException({
                title: result.data.body.message,
                message: "No se pudo obtener el id del envío desde el QR.",
            });
        }

        logBlue(`[getShipmentIdFromQr] Éxito total en ${(performance.now() - startTime).toFixed(2)} ms`);
        return result.data.body;
    } else {
        logRed(`[getShipmentIdFromQr] HTTP status ${result.status} en ${(performance.now() - startTime).toFixed(2)} ms`);
        throw new CustomException({
            title: "Error al obtener el shipmentId",
            message: "No se pudo obtener el id del envío desde el QR.",
        });
    }
}
