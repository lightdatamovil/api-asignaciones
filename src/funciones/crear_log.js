


const mysql = require('mysql');
async function crearLog(idEmpresa, operador, endpoint, result, quien, idDispositivo, modelo, marca, versionAndroid, versionApp) {
    const dbConfig = getDbConfig(company.did);
    const dbConnection = mysql.createConnection(dbConfig);

    return new Promise((resolve, reject) => {
        dbConnection.connect((err) => {
            if (err) {
                return reject({ error: "error", details: err.message });
            }

            const sql = `
                INSERT INTO logs (company, operador, request, response, quien, dispositivo, uid, appversion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                idEmpresa,
                operador,
                endpoint,
                JSON.stringify(result),
                quien,
                `${modelo} ${marca} ${versionAndroid}`,
                idDispositivo,
                versionApp
            ];

            const queryString = mysql.format(sql, values);

            dbConnection.query(sql, values, (err, results) => {
                dbConnection.end();
                if (err) {
                    return reject({ error: "error", details: err.message, query: queryString });
                } else {
                    return resolve({ error: "no error", results: results, query: queryString });
                }
            });
        });
    });
}
module.exports = crearLog;