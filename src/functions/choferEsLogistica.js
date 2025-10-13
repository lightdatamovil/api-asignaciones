
import { executeQueryFromPool } from "../../db.js";


export async function choferEsLogistica(dbConnection, driver) {
    console.log(driver);
    const query = `SELECT codvinculacion FROM sistema_usuarios_accesos WHERE usuario = ? AND superado = 0 AND elim = 0 limit 1`;
    const verify = await executeQueryFromPool(dbConnection, query, [driver], true);
    console.log("termine la query");
    console.log("resultado", verify[0]);

    //verificando si codvinculacion no es null undefine o vacio
    if (verify.length > 0 && verify[0].codvinculacion && verify[0].codvinculacion !== '') {
        // Suponiendo que 4 es el ID de la empresa de logística
        return verify[0];
    } else {
        return false;
    }
}

