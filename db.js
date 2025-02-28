import redis from 'redis';
import dotenv from 'dotenv';

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

export async function updateRedis(empresaId, envioId, choferId) {
    try {
        console.log("empresaId:", empresaId);
        console.log("envioId:", envioId);
        console.log("choferId:", choferId);

        let DWRTE = await redisClient.get('DWRTE');
        const empresaKey = `e.${empresaId}`;
        const envioKey = `en.${envioId}`;

        console.log("DWRTE antes de parsear:", DWRTE);

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

        // Guardamos la versión actualizada en Redis
        await redisClient.set('DWRTE', JSON.stringify(DWRTE));

        console.log("DWRTE actualizado:", DWRTE);
    } catch (error) {
        console.error("Error al actualizar Redis:", error);
        throw error;
    }
}

let companiesList = [];

export function getDbConfig() {
    console.log("databaseHost", databaseHost);
    console.log("databaseUser", databaseUser);
    console.log("databasePassword", databasePassword);
    console.log("databaseName", databaseName);
    return {
        host: databaseHost,
        user: databaseUser,
        password: databasePassword,
        database: databaseName,
        port: databasePort
    };
}

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
        const companysDataJson = await redisClient.get('empresasData');
        companiesList = companysDataJson ? Object.values(JSON.parse(companysDataJson)) : [];
    } catch (error) {
        console.error("Error al cargar las empresas desde Redis:", error);
        throw error;
    }
}

export async function getCompanyById(companyCode) {
    if (!Array.isArray(companiesList) || companiesList.length === 0) {
        try {
            await loadCompaniesFromRedis();
        } catch (error) {
            console.error("Error al cargar las empresas desde Redis2:", error);
            throw error;
        }
    }

    return companiesList.find(company => Number(company.did) === Number(companyCode)) || null;
}

export async function executeQuery(connection, query, values) {
    // console.log("Query:", query);
    // console.log("Values:", values);
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
