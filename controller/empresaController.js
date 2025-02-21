import { conLocal, redisClient } from '../db';
import { createServer } from 'http';
import { escape, createConnection } from 'mysql';
import { decode } from 'querystring';

async function handleOperador(dataEntrada, res) {
    const { empresa, cadete, quien, dataQR } = dataEntrada;

    if (empresa == 12 && quien == 49) {
        return sendResponse(res, { estado: false, mensaje: "Comunicarse con la logística." });
    }

    const fechaunix = Date.now();
    const sqlLog = `INSERT INTO logs (didempresa, quien, cadete, data, fechaunix) VALUES (?, ?, ?, ?, ?)`;

    try {
        await conLocal.query(sqlLog, [empresa, quien, cadete, JSON.stringify(dataQR), fechaunix]);

    } catch (err) {
        console.error("Error al insertar en logs:", err);
    }

    try {
        const dataQRParsed = dataQR

        const Aempresas2 = await iniciarProceso()

        if (!Aempresas2[empresa]) {
            return sendResponse(res, { estado: false, mensaje: "No está cargado el ID de la empresa" });
        }

        const AdataDB = Aempresas2[empresa];
        if (!AdataDB.dbname || !AdataDB.dbuser || !AdataDB.dbpass) {
            return sendResponse(res, { estado: false, mensaje: "Error al conectar a la DB" });
        }

        const con = createConnection({
            host: "bhsmysql1.lightdata.com.ar",
            user: AdataDB.dbuser,
            password: AdataDB.dbpass,
            database: AdataDB.dbname
        });

        con.connect(err => {
            if (err) {
                return sendResponse(res, { estado: false, mensaje: err.message });
            }
        });

        const isFlex = dataQRParsed.hasOwnProperty("sender_id");
        const didenvio = isFlex ? 0 : dataQRParsed.did;

        if (!isFlex) {


            handleRegularPackage(didenvio, empresa, cadete, quien, con, res, dataQRParsed);
        } else {
            handleFlexPackage(dataQRParsed.id, con, cadete, empresa, res);
        }
    } catch (error) {
        console.error("Error en el manejo del operador:", error);
        sendResponse(res, { estado: false, mensaje: "Error en el procesamiento de la solicitud." });
    }
}

async function handleRegularPackage(didenvio, empresa, cadete, quien, con, res, dataQRParsed) {
    const didempresapaquete = dataQRParsed.empresa;



    if (empresa != didempresapaquete) {
        const sql = `SELECT didLocal FROM envios_exteriores WHERE superado=0 AND elim=0 AND didExterno = ? AND didEmpresa = ?`;
        try {
            const rows = await query(con, sql, [didenvio, didempresapaquete]);
            const Aresult = rows;

            if (Aresult.length > 0) {
                const didLocal = Aresult[0]["didLocal"];
                cadete !== -2 ? asignar(didLocal, empresa, cadete, quien, res) : desasignar(didLocal, empresa, cadete, quien, res);
            } else {
                return sendResponse(res, { estado: false, mensaje: "El paquete externo no existe en la logística." });
            }
        } catch (err) {
            console.error("Error en consulta de envios_exteriores:", err);
        }
    } else {

        cadete !== -2 ? asignar(didenvio, empresa, cadete, quien, res) : desasignar(didenvio, empresa, cadete, quien, res);
    }
}

function handleFlexPackage(idshipment, con, cadete, empresa, res) {
    const query = `SELECT did FROM envios WHERE flex=1 AND superado=0 AND elim=0 AND ml_shipment_id = ?`;
    con.query(query, [idshipment], (err, rows) => {
        if (err) {
            return sendResponse(res, { estado: false, mensaje: "Error en la consulta de paquete flexible." });
        }

        const Aresult = Object.values(JSON.parse(JSON.stringify(rows)));
        con.end();

        if (Aresult.length > 0) {
            const didenvio = Aresult[0]["did"];
            cadete !== -2 ? asignar(didenvio, empresa, cadete, quien, res) : desasignar(didenvio, empresa, cadete, quien, res);
        } else {
            sendResponse(res, { estado: false, mensaje: "El paquete flexible no se encontró en la base de datos." });
        }
    });
}

function sendResponse(res, response) {
    res.status(200).json(response);
}

function query(connection, sql, params) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}
async function crearUsuario(empresa, con) {
    const username = `usuario_${empresa}`;
    const password = '78451296';

    const createUserSql = `CREATE USER IF NOT EXISTS ? IDENTIFIED BY ?`;
    const grantPrivilegesSql = `GRANT ALL PRIVILEGES ON \`asigna_data\`.* TO ?`;

    return new Promise((resolve, reject) => {
        con.query(createUserSql, [username, password], (err) => {
            if (err) {
                return reject({ estado: false, mensaje: "Error al crear el usuario." });
            }
            con.query(grantPrivilegesSql, [username], (err) => {
                if (err) {
                    return reject({ estado: false, mensaje: "Error al otorgar privilegios al usuario." });
                }
                resolve({ estado: true, mensaje: "Usuario creado y privilegios otorgados correctamente." });
            });
        });
    });
}

async function actualizarEmpresas() {
    const empresasDataJson = await redisClient.get('empresas');
    let Aempresas = JSON.parse(empresasDataJson);
    return Aempresas
}

async function crearTablaAsignaciones(empresa, con) {
    const createTableSql = `CREATE TABLE IF NOT EXISTS asignaciones_${empresa} (
        id INT NOT NULL AUTO_INCREMENT,
        didenvio INT NOT NULL,
        chofer INT NOT NULL,
        estado INT NOT NULL DEFAULT '0',
        quien INT NOT NULL,
        autofecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        desde INT NOT NULL COMMENT '0 = asignacion / 1 = web',
        superado INT NOT NULL DEFAULT '0',
        elim INT NOT NULL DEFAULT '0',
        PRIMARY KEY (id),
        KEY didenvio (didenvio),
        KEY chofer (chofer),
        KEY autofecha (autofecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1`;

    return new Promise((resolve, reject) => {
        con.query(createTableSql, (err) => {
            if (err) {
                return reject({ estado: false, mensaje: "Error al crear la tabla." });
            }
            resolve();
        });
    });
}

async function guardarDatosEnTabla(empresa, didenvio, chofer, estado, quien, desde, con) {
    const checkSql = `SELECT id FROM asignaciones_${empresa} WHERE didenvio = ${escape(didenvio)} AND superado = 0`;

    return new Promise((resolve, reject) => {
        con.query(checkSql, async (err, rows) => {
            if (err) {
                return reject({ estado: false, mensaje: "Error al verificar la tabla de asignaciones." });
            }

            const Aresult = Object.values(JSON.parse(JSON.stringify(rows)));

            if (Aresult.length > 0) {

                const updateSql = `UPDATE asignaciones_${empresa} SET superado = 1 WHERE id = ${Aresult[0].id}`;
                con.query(updateSql, (err) => {
                    if (err) {
                        return reject({ estado: false, mensaje: "Error al actualizar el registro de asignaciones." });
                    }
                    const insertSql = `INSERT INTO asignaciones_${empresa} (didenvio, chofer, estado, quien, desde) VALUES (${escape(didenvio)}, ${escape(chofer)}, ${escape(estado)}, ${escape(quien)}, ${escape(desde)})`;


                    con.query(insertSql, (err) => {
                        if (err) {
                            return reject({ estado: false, mensaje: "Error al insertar en la tabla de asignaciones." });
                        }
                        resolve({ estado: true, mensaje: "Registro insertado correctamente." });
                    });
                    resolve({ estado: true, mensaje: "Registro actualizado correctamente." });
                });
            } else {
                const insertSql = `INSERT INTO asignaciones_${empresa} (didenvio, chofer, estado, quien, desde) VALUES (${escape(didenvio)}, ${escape(chofer)}, ${escape(estado)}, ${escape(quien)}, ${escape(desde)})`;

                con.query(insertSql, (err) => {
                    if (err) {
                        return reject({ estado: false, mensaje: "Error al insertar en la tabla de asignaciones." });
                    }
                    resolve({ estado: true, mensaje: "Registro insertado correctamente." });
                });
            }
        });
    });
}



async function asignar(didenvio, empresa, cadete, quien, res) {

    const Aempresas = await iniciarProceso();
    const AdataDB = Aempresas[empresa];
    let response = "";

    const con = createConnection({
        host: "bhsmysql1.lightdata.com.ar",
        user: AdataDB.dbuser,
        password: AdataDB.dbpass,
        database: AdataDB.dbname
    });

    con.connect((err) => {
        if (err) {
            response = { estado: false, mensaje: "Error de conexión a la base de datos." };
            return res.writeHead(500).end(JSON.stringify(response));
        }
    });

    const sqlAsignado = `SELECT id,estado FROM envios_asignaciones WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)} AND operador = ${escape(cadete)}`;

    con.query(sqlAsignado, async (err, rows) => {
        if (err) {
            response = { estado: false, mensaje: "Error en la consulta de asignación." };
            con.end();
            return res.writeHead(500).end(JSON.stringify(response));
        }

        const Aresult = Object.values(JSON.parse(JSON.stringify(rows)));

        if (Aresult.length > 0 && empresa != 4) {
            ;

            const did2 = rows[0]["id"]
            const estado2 = rows[0]["estado"]
                ;
            await guardarDatosEnTabla(empresa, did2, cadete, estado2, quien, 0, conLocal);
            response = { estado: false, mensaje: "Ya tienes el paquete asignado." };
            con.end();
            return res.writeHead(200).end(JSON.stringify(response));
        } else {
            const estadoQuery = `SELECT estado FROM envios_historial WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)}`;
            con.query(estadoQuery, async (err, rows) => {
                if (err) {
                    response = { estado: false, mensaje: "Error al obtener el estado." };
                    con.end();
                    return res.writeHead(500).end(JSON.stringify(response));
                }

                const estadoResult = Object.values(JSON.parse(JSON.stringify(rows)));
                if (estadoResult.length > 0) {
                    const estado = estadoResult[0]["estado"];

                    try {
                        await crearTablaAsignaciones(empresa, conLocal);

                        await crearUsuario(empresa, conLocal);

                        const insertSql = `INSERT INTO envios_asignaciones (did, operador, didEnvio, estado, quien, desde) VALUES ("", ${escape(cadete)}, ${escape(didenvio)}, ${escape(estado)}, ${escape(quien)}, 'Movil')`;

                        con.query(insertSql, (err, result) => {

                            if (err) {
                                response = { estado: false, mensaje: "Error al insertar en envios_asignaciones." };
                                con.end();
                                return res.writeHead(500).end(JSON.stringify(response));
                            }

                            const did = result.insertId;

                            const updateDidSql = `UPDATE envios_asignaciones SET did = ${escape(did)} WHERE superado=0 AND elim=0 AND id = ${escape(did)}`;
                            con.query(updateDidSql, (err) => {
                                if (err) {
                                    response = { estado: false, mensaje: "Error al actualizar el did." };
                                    con.end();
                                    return res.writeHead(500).end(JSON.stringify(response));
                                }

                                const superadoSql = `UPDATE envios_asignaciones SET superado = 1 WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)} AND did != ${escape(did)}`;
                                con.query(superadoSql, (err) => {
                                    if (err) {
                                        response = { estado: false, mensaje: "Error al marcar como superado." };
                                        con.end();
                                        return res.writeHead(500).end(JSON.stringify(response));
                                    }

                                    const choferSql = `UPDATE envios SET choferAsignado = ${escape(cadete)} WHERE superado=0 AND elim=0 AND did = ${escape(didenvio)}`;
                                    con.query(choferSql, (err) => {
                                        if (err) {
                                            response = { estado: false, mensaje: "Error al actualizar chofer." };
                                            con.end();
                                            return res.writeHead(500).end(JSON.stringify(response));
                                        }

                                        const ruteoSql = `UPDATE ruteo_paradas SET superado = 1 WHERE superado=0 AND elim=0 AND didPaquete = ${escape(didenvio)}`;
                                        con.query(ruteoSql, (err) => {
                                            if (err) {
                                                response = { estado: false, mensaje: "Error al actualizar ruteo." };
                                                con.end();
                                                return res.writeHead(500).end(JSON.stringify(response));
                                            }

                                            const historialSql = `UPDATE envios_historial SET didCadete = ${escape(cadete)} WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)}`;
                                            con.query(historialSql, (err) => {
                                                if (err) {
                                                    response = { estado: false, mensaje: "Error al actualizar historial." };
                                                    con.end();
                                                    return res.writeHead(500).end(JSON.stringify(response));
                                                }

                                                const costoSql = `UPDATE envios SET costoActualizadoChofer = 0 WHERE superado=0 AND elim=0 AND did = ${escape(didenvio)}`;
                                                con.query(costoSql, async (err) => {
                                                    if (err) {
                                                        response = { estado: false, mensaje: "Error al actualizar costos." };
                                                        con.end();
                                                        return res.writeHead(500).end(JSON.stringify(response));
                                                    }

                                                    const guardamos = await guardarDatosEnTabla(empresa, did, cadete, estado, quien, 0, conLocal);

                                                    response = { estado: true, mensaje: "Paquete asignado correctamente." };
                                                    con.end();
                                                    return res.writeHead(200).end(JSON.stringify(response));
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    } catch (error) {
                        response = error;
                        con.end();
                        return res.writeHead(500).end(JSON.stringify(response));
                    }
                } else {
                    response = { estado: false, mensaje: "No se encontraron datos." };
                    con.end();
                    return res.writeHead(404).end(JSON.stringify(response));
                }
            });
        }
    });
}


async function desasignar(didenvio, empresa, res) {
    const AdataDB = Aempresas[empresa];
    let response = "";

    const con = createConnection({
        host: "bhsmysql1.lightdata.com.ar",
        user: AdataDB.dbuser,
        password: AdataDB.dbpass,
        database: AdataDB.dbname
    });

    con.connect(function (err) {
        if (err) {
            response = { estado: false, mensaje: "Error de conexión a la base de datos." };
            res.writeHead(500);
            return res.end(JSON.stringify(response));
        }
    });

    let sql = `UPDATE envios_asignaciones SET superado=1 WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)}`;
    con.query(sql, (err) => {
        if (err) {
            response = { estado: false, mensaje: "Error al desasignar." };
            con.end();
            return res.writeHead(500).end(JSON.stringify(response));
        }

        let historialSql = `UPDATE envios_historial SET didCadete=0 WHERE superado=0 AND elim=0 AND didEnvio = ${escape(didenvio)}`;
        con.query(historialSql, (err) => {
            if (err) {
                response = { estado: false, mensaje: "Error al actualizar historial." };
                con.end();
                return res.writeHead(500).end(JSON.stringify(response));
            }

            let choferSql = `UPDATE envios SET choferAsignado = 0 WHERE superado=0 AND elim=0 AND did = ${escape(didenvio)}`;
            con.query(choferSql, (err) => {
                if (err) {
                    response = { estado: false, mensaje: "Error al desasignar chofer." };
                    con.end();
                    return res.writeHead(500).end(JSON.stringify(response));
                }

                response = { estado: true, mensaje: "Paquete desasignado correctamente." };
                con.end();
                return res.writeHead(200).end(JSON.stringify(response));
            });
        });
    });
}

const server = createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', async () => {
            const dataEntrada = decode(body);
            const operador = dataEntrada.operador;

            if (operador === "actualizarEmpresas") {
            } else if (operador === "getEmpresas") {
                const buffer = JSON.stringify("pruebas2 =>" + JSON.stringify(Aempresas));
                res.writeHead(200);
                res.end(buffer);
            } else {
                await handleOperador(dataEntrada, res);
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

async function handleOperador(dataEntrada, res) {
    const { empresa, cadete, quien, dataQR } = dataEntrada;

    if (empresa == 12 && quien == 49) {
        const response = { estado: false, mensaje: "Comunicarse con la logística." };
        return sendResponse(res, response);
    }

    const fechaunix = Date.now();
    const sqlLog = `INSERT INTO logs (didempresa, quien, cadete, data, fechaunix) VALUES (${escape(empresa)}, ${escape(quien)}, ${escape(cadete)}, ${escape(dataQR)}, ${escape(fechaunix)})`;

    conLocal.query(sqlLog, (err, result) => {
        if (err) {
            console.error("Error al insertar en logs:", err);
        }
    });

    const dataQRParsed = JSON.parse(dataQR);
    if (Aempresas[empresa]) {
        const AdataDB = Aempresas[empresa];

        if (AdataDB.dbname && AdataDB.dbuser && AdataDB.dbpass) {
            const con = createConnection({
                host: "bhsmysql1.lightdata.com.ar",
                user: AdataDB.dbuser,
                password: AdataDB.dbpass,
                database: AdataDB.dbname
            });

            con.connect(err => {
                if (err) {
                    const response = { estado: false, mensaje: err.message };
                    return sendResponse(res, response);
                }
            });

            const isFlex = dataQRParsed.hasOwnProperty("sender_id");
            let didenvio = isFlex ? 0 : dataQRParsed.did;

            if (!isFlex) {
                handleRegularPackage(didenvio, empresa, cadete, quien, con, res);
            } else {
                handleFlexPackage(dataQRParsed.id, con, cadete, empresa, res);
            }
        } else {
            const response = { estado: false, mensaje: "Error al conectar a la DB" };
            sendResponse(res, response);
        }
    } else {
        const response = { estado: false, mensaje: "No está cargado el ID de la empresa" };
        sendResponse(res, response);
    }
}

function handleRegularPackage(didenvio, empresa, cadete, quien, con, res) {
    const didempresapaquete = dataQRParsed.empresa;

    if (empresa !== didempresapaquete) {
        const sql = `SELECT didLocal FROM envios_exteriores WHERE superado=0 AND elim=0 AND didExterno = ${escape(didenvio)} AND didEmpresa = ${escape(didempresapaquete)}`;
        con.query(sql, (err, rows) => {
            if (err) {
                console.error("Error en consulta de envios_exteriores:", err);
            }

            const Aresult = Object.values(JSON.parse(JSON.stringify(rows)));
            con.end();

            if (Aresult.length > 0) {
                const didLocal = Aresult[0]["didLocal"];
                if (cadete !== -2) {
                    asignar(didLocal, empresa, cadete, quien, res);
                } else {
                    desasignar(didLocal, empresa, cadete, quien, res);
                }
            } else {
                const response = { estado: false, mensaje: "El paquete externo no existe en la logística." };
                sendResponse(res, response);
            }
        });
    } else {
        if (cadete !== -2) {
            asignar(didenvio, empresa, cadete, quien, res);
        } else {
            desasignar(didenvio, empresa, cadete, quien, res);
        }
    }
}

function handleFlexPackage(idshipment, con, cadete, empresa, res) {
    const query = `SELECT did FROM envios WHERE flex=1 AND superado=0 AND elim=0 AND ml_shipment_id = ${escape(idshipment)}`;
    con.query(query, (err, rows) => {
        if (err) {
            const response = { estado: false, mensaje: query };
            sendResponse(res, response);
            return;
        }

        const Aresult = Object.values(JSON.parse(JSON.stringify(rows)));
        con.end();

        if (Aresult.length > 0) {
            const didenvio = Aresult[0]["did"];
            if (cadete !== -2) {
                asignar(didenvio, empresa, cadete, quien, res);
            } else {
                desasignar(didenvio, empresa, cadete, quien, res);
            }
        } else {
        }
    });
}

function sendResponse(res, response) {
    const buffer = JSON.stringify(response);
    res.writeHead(200);
    res.end(buffer);
}

async function iniciarProceso() {
    try {
        await redisClient.connect();

        let empresas = await actualizarEmpresas(Aempresas);

        await redisClient.quit();
        return empresas
    } catch (error) {
        console.error("Error en el proceso:", error);
    }
}

let Aempresas = iniciarProceso();


export default { asignar, desasignar, Aempresas, iniciarProceso, actualizarEmpresas };
