import axios from "axios";
import { logRed } from "./logsCustom.js";
import CustomException from "../../classes/custom_exception.js";

export async function getShipmentIdFromQr(companyId, dataQr) {
    logRed(`llegue 3 ${companyId} - ${dataQr}`);
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
    logRed(`llegue 3.5 ${JSON.stringify(payload)}`);
    let result;
    try {

        result = await axios.post('https://apimovil2.lightdata.app/api/qr/get-shipment-id', payload);
    } catch (error) {

        throw new CustomException({
            title: "Error al obtener el shipmentId",
            message: "No se pudo obtener el id del envío desde el QR."
        });
    }
    logRed(`llegue 4 ${result}`);
    if (result.status == 200) {
        logRed(`llegue 5 ${result}`);
        if (Object.prototype.hasOwnProperty.call(result.data.body, "success") && result.data.body.success == false) {
            throw new CustomException({
                title: result.data.body.message,
                message: "No se pudo obtener el id del envío desde el QR."
            });
        }
        return result.data.body;
    } else {
        logRed("Error al obtener el shipmentId");
        throw new CustomException({
            title: "Error al obtener el shipmentId",
            message: "No se pudo obtener el id del envío desde el QR."
        });
    }
}