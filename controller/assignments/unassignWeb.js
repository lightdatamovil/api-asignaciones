import { CustomException } from "lightdata-tools";
import { executeQuery, getCompanyByCode, getProdDbConfig } from "../../db.js";
import { choferEsLogistica } from "../../src/functions/choferEsLogistica.js";
import { debugHttpError } from "../../src/functions/debugEndpoint.js";
import { insertAsignacionesDB } from "../functions/insertAsignacionesDB.js";
import mysql2 from "mysql2";

const URL_ELIMINAR_ENVIO = "https://altaenvios.lightdata.com.ar/api/eliminarEnvio";


export async function desasignar_web(dbConnection, company, userId, shipmentId, deviceFrom) {
    const quien = userId;

    const sqlOperador =
        "SELECT operador, estado FROM envios_asignaciones WHERE didEnvio = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, sqlOperador, [shipmentId]);

    const operador = result.length > 0 ? result[0].operador : 0;

    if (operador == 0) {
        return {
            feature: "asignacion",
            success: false,
            message: "El paquete ya está desasignado.",
        };
    }

    if (!shipmentId) {

        return {
            feature: "asignacion",
            success: false,
            message: "Error al obtener el id del envio",
        };
    }


    const operadorEsLogistica = await choferEsLogistica(dbConnection, operador);


    if (operadorEsLogistica) {



        //traer de redis el did de la compania externa por el codvinculacion
        const companiaExterna = await getCompanyByCode(operadorEsLogistica.codvinculacion);
        let dbConnectionExterna, shipmentIdExterno;
        // conectarme a nueva empresa
        try {
            const dbConfigExterna = getProdDbConfig(companiaExterna);
            dbConnectionExterna = mysql2.createConnection(dbConfigExterna);
            dbConnectionExterna.connect();

            // traer el shipmentIdExterno desde envios_historial o armar el qr pero necesito elt acking del envio
            const sqlHistorial = "SELECT didLocal FROM envios_exteriores WHERE didExterno = ? AND superado = 0 AND elim = 0 LIMIT 1";

            const resultHistorial = await executeQuery(dbConnectionExterna, sqlHistorial, [shipmentId], true);
            shipmentIdExterno = resultHistorial[0].didLocal;


        } catch (error) {
            throw new CustomException({
                title: "Error de conexión",
                message: `No se pudo conectar a la base de datos de la compañía externa. Error: ${error.message}`,
            });

        } finally {
            dbConnectionExterna.end();
        }

        // envio al microservicio eliminar envio de todas las tablas 
        const payload = {
            idEmpresa: companiaExterna.did,
            did: shipmentIdExterno,
            userId: quien,
            desde: deviceFrom,
        };


        try {
            await fetch(URL_ELIMINAR_ENVIO, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            debugHttpError(error, "desasignar - eliminar envio");
        }

    }
    if (company.did == 4) {
        const setEstadoAsignacion =
            "UPDATE envios SET estadoAsignacion = 0 WHERE superado = 0 AND elim=0 AND did = ?";
        await executeQuery(dbConnection, setEstadoAsignacion, [shipmentId]);
    }

    const insertQuery =
        "INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES (?, ?, ?, ?, ?, ?)";
    const resultInsertQuery = await executeQuery(dbConnection, insertQuery, [
        "",
        0,
        shipmentId,
        result[0].estado,
        userId,
        deviceFrom,
    ]);

    // Actualizar asignaciones
    await executeQuery(
        dbConnection,
        `UPDATE envios_asignaciones SET superado=1, did=${resultInsertQuery.insertId} WHERE superado=0 AND elim=0 AND didEnvio = ?`,
        [shipmentId]
    );

    // Actualizar historial
    // await executeQuery(
    //     dbConnection,
    //     `UPDATE envios_historial SET didCadete=0 WHERE superado=0 AND elim=0 AND didEnvio = ?`,
    //     [shipmentId]
    // );

    // Desasignar chofer
    await executeQuery(
        dbConnection,
        `UPDATE envios SET choferAsignado = 0 WHERE superado=0 AND elim=0 AND did = ?`,
        [shipmentId]
    );

    await insertAsignacionesDB(
        company.did,
        shipmentId,
        0,
        result[0].estado,
        userId,
        deviceFrom
    );

    // await updateRedis(company.did, shipmentId, 0);

    const resultado = {
        feature: "asignacion",
        success: true,
        message: "Desasignación realizada correctamente",
    };

    return resultado;
}
