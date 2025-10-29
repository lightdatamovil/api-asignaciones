import redis from 'redis';
import dotenv from 'dotenv';
import mysql2 from 'mysql2/promise';
import { CompaniesService } from 'lightdata-tools';
import https from 'https';
import axios from 'axios';

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
export const hostProductionDb = process.env.PRODUCTION_DB_HOST;
export const portProductionDb = process.env.PRODUCTION_DB_PORT;

// JWT
export const jwtSecret = process.env.JWT_SECRET;
export const jwtIssuer = process.env.JWT_ISSUER;
export const jwtAudience = process.env.JWT_AUDIENCE;
export const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';

export const urlEstadosMicroservice = process.env.URL_ESTADOS_MICROSERVICE;
export const urlApimovilGetShipmentId = process.env.URL_APIMOVIL_GET_SHIPMENT_ID;

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

export const poolLocal = mysql2.createPool({
    host: asignacionesDBHost,
    user: asignacionesDBUser,
    password: asignacionesDBPassword,
    database: asignacionesDBName,
    port: asignacionesDBPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export const companiesService = new CompaniesService({ redisClient, redisKey: "empresasData" })

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

export const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    timeout: 10000,
    family: 4,
});

export const axiosInstance = axios.create({
    httpsAgent,
    timeout: 335000,
});
