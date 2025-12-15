import axios from "axios";
import https from "https";
import { logRed } from "./logsCustom.js";
import CustomException from "../../classes/custom_exception.js";

// 🔹 Agente HTTPS con keep-alive y hasta 100 conexiones simultáneas
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    timeout: 20000, // tiempo máximo de socket en ms
    family: 4, // fuerza IPv4, evita delay IPv6
});

// 🔹 Axios preconfigurado (usa el agente y timeout)
const axiosInstance = axios.create({
    httpsAgent,
    timeout: 20000, // 5 segundos máximo por request
});

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
        dataQr,
    };

    const url = "https://apimovil2.lightdata.app/api/qr/get-shipment-id";

    let result;
    try {
        result = await axiosInstance.post(url, payload);
    } catch (error) {
        logRed(
            `[getShipmentIdFromQr] Error durante request: ${(performance.now() - startTime).toFixed(
                2
            )} ms (${error.code || error.message})`
        );
        throw new CustomException({
            title: "Error al obtener el shipmentId",
            message: "No se pudo obtener el id del envío desde el QR.",
        });
    }

    const afterResponse = performance.now();

    if (result?.status === 200) {
        const body = result.data?.body ?? {};
        if (body.success === false) {
            logRed(
                `[getShipmentIdFromQr] Respuesta inválida en ${(afterResponse - startTime).toFixed(2)} ms`
            );
            throw new CustomException({
                title: body.message || "Respuesta inválida",
                message: "No se pudo obtener el id del envío desde el QR.",
            });
        }
        return body;
    }

    logRed(
        `[getShipmentIdFromQr] HTTP status ${result?.status ?? "desconocido"} en ${(performance.now() - startTime).toFixed(2)} ms`
    );
    throw new CustomException({
        title: "Error al obtener el shipmentId",
        message: "No se pudo obtener el id del envío desde el QR.",
    });
}
