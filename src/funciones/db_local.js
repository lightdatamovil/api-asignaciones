import mysql from 'mysql';
import { getDbConfig, executeQuery } from '../../db.js';

export async function crearTablaAsignaciones(companyId) {
    const dbConfig = getDbConfig();
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    try {
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS asignaciones_${companyId} (
                id INT NOT NULL AUTO_INCREMENT,
                didenvio INT NOT NULL,
                chofer INT NOT NULL,
                estado INT NOT NULL DEFAULT 0,
                quien INT NOT NULL,
                autofecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                desde INT NOT NULL COMMENT '0 = asignacion / 1 = web',
                superado INT NOT NULL DEFAULT 0,
                elim INT NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                KEY didenvio (didenvio),
                KEY chofer (chofer),
                KEY autofecha (autofecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
        `;

        await executeQuery(dbConnection, createTableSql);
    } catch (error) {
        console.error("Error al crear la tabla de asignaciones:", error);
        throw error;
    } finally {
        dbConnection.end();
    }
}

export async function crearUsuario(companyId) {
    const dbConfig = getDbConfig();
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    try {
        const username = `usuario_${companyId}`;
        const password = '78451296';

        const createUserSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
        const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?@'%'`;

        await executeQuery(dbConnection, createUserSql, [username, password]);
        await executeQuery(dbConnection, grantPrivilegesSql, [username]);

        return;
    } catch (error) {
        console.error("Error al crear el usuario:", error);
        throw error;
    } finally {
        dbConnection.end();
    }
}

export async function insertAsignacionesDB(companyId, shipmentId, driverId, shipmentState, userId, deviceFrom) {
    const dbConfig = getDbConfig();
    const dbConnection = mysql.createConnection(dbConfig);
    dbConnection.connect();

    try {
        const checkSql = `SELECT id FROM asignaciones_${companyId} WHERE didenvio = ? AND superado = 0`;
        const existingRecords = await executeQuery(dbConnection, checkSql, [shipmentId]);

        if (existingRecords.length > 0) {
            const updateSql = `UPDATE asignaciones_${companyId} SET superado = 1 WHERE id = ?`;
            await executeQuery(dbConnection, updateSql, [existingRecords[0].id]);

            const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
            await executeQuery(dbConnection, insertSql, [shipmentId, driverId, shipmentState, userId, deviceFrom]);
        } else {
            const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
            await executeQuery(dbConnection, insertSql, [shipmentId, driverId, shipmentState, userId, deviceFrom]);
        }
    } catch (error) {
        console.error("Error al insertar asignaciones en la base de datos:", error);
        throw error;
    } finally {
        dbConnection.end();
    }
}
