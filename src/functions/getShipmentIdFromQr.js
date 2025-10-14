import axios from "axios";
import https from "https";
import { logBlue, logRed } from "./logsCustom.js";
import CustomException from "../../classes/custom_exception.js";

// 🔹 Agente HTTPS con keep-alive y hasta 100 conexiones simultáneas
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    timeout: 10000, // tiempo máximo de socket en ms
    family: 4, // fuerza IPv4, evita delay IPv6
});

// 🔹 Axios preconfigurado (usa el agente y timeout)
const axiosInstance = axios.create({
    httpsAgent,
    timeout: 5000, // 5 segundos máximo por request
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

    logBlue(`[getShipmentIdFromQr] Inicio: ${performance.now() - startTime} ms`);

    const url = "https://apimovil2.lightdata.app/api/qr/get-shipment-id";

    // 🔁 Intentar hasta 3 veces con backoff exponencial (0.5s, 1s, 2s)
    let attempt = 0;
    let result;
    while (attempt < 3) {
        attempt++;
        const attemptStart = performance.now();
        try {
            result = await axiosInstance.post(url, payload);
            const duration = performance.now() - attemptStart;
            logBlue(
                `[getShipmentIdFromQr] Request completada en ${duration.toFixed(
                    2
                )} ms para el envío ${JSON.stringify(dataQr)} de la empresa ${companyId} (intento ${attempt})`
            );
            break; // Éxito → salir del bucle
        } catch (error) {
            const duration = performance.now() - attemptStart;
            logRed(
                `[getShipmentIdFromQr] Error en intento ${attempt}: ${error.code || error.message
                } (${duration.toFixed(2)} ms)`
            );
            if (attempt >= 3) {
                throw new CustomException({
                    title: "Error al obtener el shipmentId",
                    message: "No se pudo obtener el id del envío desde el QR.",
                });
            }
            // espera incremental antes del próximo intento
            const wait = 500 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, wait));
        }
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

        logBlue(`[getShipmentIdFromQr] Éxito total en ${(performance.now() - startTime).toFixed(2)} ms`);
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
