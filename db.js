import redis from 'redis';
import dotenv from 'dotenv';
import mysql2 from 'mysql2';
import { logRed, logYellow } from './src/functions/logsCustom.js';

dotenv.config({ path: process.env.ENV_FILE || ".env" });

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

const databaseHost = process.env.DATABASE_HOST;
const databasePort = process.env.DATABASE_PORT;
const databaseUser = process.env.DATABASE_USER;
const databasePassword = process.env.DATABASE_PASSWORD;
const databaseName = process.env.DATABASE_NAME;

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
    host: databaseHost,
    user: databaseUser,
    password: databasePassword,
    database: databaseName,
    port: databasePort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function updateRedis(empresaId, envioId, choferId) {
    try {
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
    } catch (error) {
        console.error("Error al actualizar Redis:", error);
        throw error;
    }
}

let companiesList = [];


export function getProdDbConfig(company) {
    return {
        host: "bhsmysql1.lightdata.com.ar",
        user: company.dbuser,
        password: company.dbpass,
        database: company.dbname
    };
}

async function loadCompaniesFromRedis() {
    try {
        const companiesListString = await redisClient.get('empresasData');

        companiesList = JSON.parse(companiesListString);

    } catch (error) {
        console.error("Error en loadCompaniesFromRedis:", error);
        throw error;
    }
}

export async function getCompanyById(companyId) {
    try {
        let company = companiesList[companyId];

        if (company == undefined || Object.keys(companiesList).length === 0) {
            try {
                await loadCompaniesFromRedis();

                company = companiesList[companyId];
            } catch (error) {
                console.error("Error al cargar compañías desde Redis:", error);
                throw error;
            }
        }

        return company;
    } catch (error) {
        console.error("Error en getCompanyById:", error);
        throw error;
    }
}

export async function executeQuery(connection, query, values) {
    try {
        return new Promise((resolve, reject) => {
            connection.query(query, values, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    } catch (error) {
        console.error("Error al ejecutar la query:", error);
        throw error;
    }
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
