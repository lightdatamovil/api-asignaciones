import redis from 'redis';
import dotenv from 'dotenv';
import mysql2 from 'mysql2';
import { logRed, logYellow } from './src/functions/logsCustom.js';

dotenv.config({ path: process.env.ENV_FILE || ".env" });

/// Se usan para traer todas las empresas
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

/// Se usa para los logs
const asignacionesDBHost = process.env.ASIGNACIONES_DB_HOST;
const asignacionesDBUser = process.env.ASIGNACIONES_DB_USER;
const asignacionesDBPassword = process.env.ASIGNACIONES_DB_PASSWORD;
const asignacionesDBName = process.env.ASIGNACIONES_DB_NAME;
const asignacionesDBPort = process.env.ASIGNACIONES_DB_PORT;

/// Se usa para la conexion a la base de datos de produccion de cada endpoint
const hostProductionDb = process.env.HOST_PRODUCTION_DB;

export const redisClient = redis.createClient({
    socket: {
        host: redisHost,
        port: redisPort,
    },
    password: redisPassword,
});

redisClient.on('error', (err) => {
    console.error('Error al conectar con Redis:', err);
});

const poolLocal = mysql2.createPool({
    host: asignacionesDBHost,
    user: asignacionesDBUser,
    password: asignacionesDBPassword,
    database: asignacionesDBName,
    port: asignacionesDBPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function updateRedis(empresaId, envioId, choferId) {
    let DWRTE = await redisClient.get('DWRTE');
    const empresaKey = `e.${empresaId}`;
    const envioKey = `en.${envioId}`;

    // Si no existe en Redis, inicializamos con un objeto vacío
    if (!DWRTE) {
        DWRTE = {};
    } else {
        DWRTE = JSON.parse(DWRTE); // Convertimos el string en objeto
    }

    // Si la empresa no existe, la creamos
    if (!DWRTE[empresaKey]) {
        DWRTE[empresaKey] = {};
    }

    // Solo agrega si el envío no existe
    if (!DWRTE[empresaKey][envioKey]) {
        DWRTE[empresaKey][envioKey] = {
            choferId: choferId
        };
    }

    await redisClient.set('DWRTE', JSON.stringify(DWRTE));
}

let companiesList = [];


export function getProdDbConfig(company) {
    return {
        host: hostProductionDb,
        user: company.dbuser,
        password: company.dbpass,
        database: company.dbname
    };
}

async function loadCompaniesFromRedis() {
    const companiesListString = await redisClient.get('empresasData');

    companiesList = JSON.parse(companiesListString);
}

export async function getCompanyById(companyId) {
    let company = companiesList[companyId];

    if (company == undefined || Object.keys(companiesList).length === 0) {
        await loadCompaniesFromRedis();

        company = companiesList[companyId];
    }

    return company;
}

export async function executeQuery(connection, query, values) {
    return new Promise((resolve, reject) => {
        connection.query(query, values, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

export function executeQueryFromPool(query, values = [], log = false) {
    const formattedQuery = mysql2.format(query, values);

    return new Promise((resolve, reject) => {
        if (log) logYellow(`Ejecutando query: ${formattedQuery}`);

        poolLocal.query(formattedQuery, (err, results) => {
            if (err) {
                if (log) logRed(`Error en executeQuery: ${err.message} - ${formattedQuery}`);
                return reject(err);
            }
            if (log) logYellow(`Query ejecutada con éxito: ${formattedQuery}`);
            resolve(results);
        });
    });
}
