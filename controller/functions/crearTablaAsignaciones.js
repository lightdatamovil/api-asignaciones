import { executeQueryFromPool } from '../../db.js';
export async function crearTablaAsignaciones(companyId) {

    const createTableSql = `
            CREATE TABLE IF NOT EXISTS asignaciones_${companyId} (
                id INT NOT NULL AUTO_INCREMENT,
                didenvio INT NOT NULL,
                chofer INT NOT NULL,
                estado INT NOT NULL DEFAULT 0,
                quien INT NOT NULL,
                autofecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                desde INT NOT NULL COMMENT '0 = asignacion / 1 = web',
                superado INT NOT NULL DEFAULT 0,
                elim INT NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                KEY didenvio (didenvio),
                KEY chofer (chofer),
                KEY autofecha (autofecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
        `;

    await executeQueryFromPool(createTableSql);

}
