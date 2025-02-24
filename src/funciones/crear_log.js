import { createConnection, format } from 'mysql';
async function crearLog(idEmpresa, operador, endpoint, result, quien, idDispositivo, modelo, marca, versionAndroid, versionApp) {
    const dbConfig = getDbConfig(company.did);
    const dbConnection = createConnection(dbConfig);

    return new Promise((resolve, reject) => {
        dbConnection.connect((err) => {
            if (err) {
                return reject({ error: "error", details: err.message });
            }

            const fechaunix = Date.now();
            const sqlLog = `INSERT INTO logs (didempresa, quien, cadete, data, fechaunix) VALUES (?, ?, ?, ?, ?)`;

            await conLocal.query(sqlLog, [empresa, quien, cadete, JSON.stringify(dataQR), fechaunix]);
            const queryString = format(sql, values);

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
export default crearLog;