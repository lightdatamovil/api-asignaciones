import axios from "axios";
import { logRed } from "./logsCustom.js";
import CustomException from "../../clases/custom_exception.js";

export async function getShipmentIdFromQr(companyId, dataQr) {
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