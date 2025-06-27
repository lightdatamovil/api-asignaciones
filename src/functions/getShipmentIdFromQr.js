import axios from "axios";
import { logRed } from "./logsCustom.js";

export async function getShipmentIdFromQr(companyId, dataQr) {

    try {
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
            dataQr: dataQr
        };

        const result = await axios.post('https://apimovil2.lightdata.app/api/qr/get-shipment-id', payload);
        if (result.status == 200) {
            return result.data.body;
        } else {
            logRed("Error al obtener el shipmentId");
            throw new Error("Error al obtener el shipmentId");
        }
    } catch (error) {
        logRed(`Error al obtener el shipmentId: ${error.stack}`);
        throw error;
    }
}