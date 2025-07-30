import CustomException from "../../classes/custom_exception.js";
import { executeQuery } from "../../db.js";

export async function checkIfFulfillment(dbConnection, shipmentId) {
    const checkIfFFA = `SELECT elim FROM envios WHERE superado=0 AND elim=52 AND did = ?`;
    const ffaRows = await executeQuery(dbConnection, checkIfFFA, [shipmentId]);


    if (ffaRows.length > 0) {
        throw new CustomException({
            title: "Fulfillment Error",
            message: "El paquete todavia no esta armado, espera a terminar el proceso y vuelva a intentarlo.",
        });
    }
}