import mysql from 'mysql2';
import { executeQueryFromPool } from 'lightdata-tools';
import { poolLocal } from '../../db.js';

export async function crearUsuario(companyId) {
    const username = `usuario_${companyId}`;
    const host = '%';
    const password = '78451296';

    const userExpr = `${mysql.escape(username)}@${mysql.escape(host)}`; // 'usuario_164'@'%'

    const createUserSql = `CREATE USER IF NOT EXISTS ${userExpr} IDENTIFIED BY ${mysql.escape(password)}`;
    const grantSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ${userExpr}`;

    await executeQueryFromPool(poolLocal, createUserSql);   // <-- SIN values
    await executeQueryFromPool(poolLocal, grantSql);        // <-- SIN values
}
