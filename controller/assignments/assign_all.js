import { LightdataORMHOTFIX } from "../../classes/LightdataORMHOTFIX.js";
import { executeQuery } from "../../db.js";
import { parseShipmentIds } from "../../src/functions/stringAArray.js";
import CustomException from "../../classes/custom_exception.js";

export async function asignar_masivo(
    dbConnection,
    userId,
    shipmentIds,
    driverId,
) {
    const deviceFrom = "excel";
    const enviosAsign = parseShipmentIds(shipmentIds);

    //verificar algun ff
    const sqlff = ` SELECT did FROM envios WHERE superado = 0 AND elim = 52 AND did IN (${shipmentIds})  `;
    const rowsff = await executeQuery(dbConnection, sqlff, [], true);

    /*
    if (rowsff.length > 0) {
        throw new CustomException({
            title: "Error de asignación",
            message: `Algunos de los envíos seleccionados corresponden a Fulfillment. No se pueden asignar.`
        });
    }

*/

    //si algun envio es ff lo saco de mi mi lista enviosAsign
    const ffIds = rowsff.map(r => r.did);
    const enviosAsignFiltered = enviosAsign.filter(e => !ffIds.includes(e));
    console.log("Envios FF filtrados:", ffIds);
    console.log("Envios a asignar despues de filtrar FF:", enviosAsignFiltered);

    //todo necesito obetener el estado de cada paquete? para que?

    //   await crearTablaAsignaciones(company.did);

    //   await crearUsuario(company.did);

    // insertar en envios_asignaciones los envios asinados a ese chofer

    //mapear todo lo demas a data
    const data = enviosAsignFiltered.map((e) => ({
        didEnvio: e,
        operador: driverId,
        quien: userId,
        desde: deviceFrom
    }));

    console.log("Envios a asignar:", enviosAsignFiltered);

    console.log("Data para asignacion masiva:", data);

    const insert = await LightdataORMHOTFIX.insert({
        db: dbConnection,
        table: "envios_asignaciones",
        versionKey: "didEnvio",
        throwIfNotExists: false,
        quien: userId,
        data: data,
        log: true
    });

    console.log(data.length, "envios asignados");

    await executeQuery(dbConnection, `UPDATE envios_asignaciones SET superado = 1 WHERE didEnvio IN (${shipmentIds}) AND did NOT IN (${insert})`, [], true);

    await LightdataORMHOTFIX.update({
        db: dbConnection,
        table: "envios",
        where: { did: enviosAsign },
        throwIfNotExists: false,
        quien: userId,
        data: { choferAsignado: driverId, costoActualizadoChofer: 0 },
        log: true
    });

    /*
        await LightdataORMHOTFIX.upsert({
            db: dbConnection,
            table: "ruteo_paradas",
            where: { didPaquete: enviosAsign },
            versionKey: "didPaquete",
            throwIfNotExists: false,
            quien: userId,
            data: { superado: 1 },
            log: true
        });
        */

    // { sql: `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim<>1 AND didPaquete = ?`, values: [shipmentId], },
    await executeQuery(dbConnection, `UPDATE ruteo_paradas SET superado = 1 WHERE didPaquete IN (${shipmentIds})`, [], true);

    /*
        if (insert.length < data.length) {
            throw new CustomException({
                title: "Error de asignación",
                message: `Algunos de los envíos seleccionados no se asignaron.`
            });
        }
    */
    const resultado = {
        feature: "asignacion-masiva",
        cantidadAsignada: insert.length,
        enviosFF: ffIds,
        success: true,
        message: "Asignación realizada correctamente",
    };

    return resultado;
}