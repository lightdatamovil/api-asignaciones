import { executeQuery } from '../../db.js';
import { logRed } from '../../src/functions/logsCustom.js';

export async function crearUsuario(dbConnectionLocal, companyId) {
    try {
        const username = `usuario_${companyId}`;
        const password = '78451296';

        const createUserSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
        const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?@'%'`;

        await executeQuery(dbConnectionLocal, createUserSql, [username, password]);
        await executeQuery(dbConnectionLocal, grantPrivilegesSql, [username]);

        return;
    } catch (error) {
        logRed(`Error al crear el usuario:  ${error.stack}`)

        throw error;
    }
}
