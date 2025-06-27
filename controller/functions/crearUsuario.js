import { executeQueryFromPool } from '../../db.js';

export async function crearUsuario(companyId) {
    const username = `usuario_${companyId}`;
    const password = '78451296';

    const createUserSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
    const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?@'%'`;

    await executeQueryFromPool(createUserSql, [username, password]);
    await executeQueryFromPool(grantPrivilegesSql, [username]);
}
