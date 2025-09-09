import { executeQueryFromPool } from "lightdata-tools";
import { poolLocal } from "../../db.js";

export async function crearUsuario(companyId) {
    const username = `usuario_${companyId}`;
    const password = '78451296';

    const createUserSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
    const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?@'%'`;

    await executeQueryFromPool(poolLocal, createUserSql, [username, password]);
    await executeQueryFromPool(poolLocal, grantPrivilegesSql, [username]);
}
