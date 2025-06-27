import { getProdDbConfig } from "../../db.js";
import mysql2 from "mysql2";

export function getConnection(company) {
    const dbConfig = getProdDbConfig(company);
    const connection = mysql2.createConnection(dbConfig);
    return connection;
}