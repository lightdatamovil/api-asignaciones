import { executeQueryFromPool } from '../../db.js';
import { logRed } from '../../src/functions/logsCustom.js';

export async function crearUsuario(companyId) {
    try {
        const username = `usuario_${companyId}`;
        const password = '78451296';

        const createUserSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
        const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?@'%'`;

        await executeQueryFromPool(createUserSql, [username, password]);
        await executeQueryFromPool(grantPrivilegesSql, [username]);

        return;
    } catch (error) {
        logRed(`Error al crear el usuario:  ${error.stack}`)

        throw error;
    }
}
