import { executeQueryFromPool } from "lightdata-tools";
import { poolLocal } from "../../db.js";

export async function insertAsignacionesDB(
  companyId,
  shipmentId,
  driverId,
  shipmentState,
  userId,
  deviceFrom
) {

  const checkSql = `SELECT id FROM asignaciones_${companyId} WHERE didenvio = ? AND superado = 0`;
  const existingRecords = await executeQueryFromPool({
    pool: poolLocal,
    query: checkSql,
    values: [shipmentId]
  });

  if (existingRecords.length > 0) {
    const updateSql = `UPDATE asignaciones_${companyId} SET superado = 1 WHERE id = ?`;
    await executeQueryFromPool({ pool: poolLocal, query: updateSql, values: [existingRecords[0].id] });

    const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
    await executeQueryFromPool({
      pool: poolLocal, query: insertSql, values: [
        shipmentId,
        driverId,
        shipmentState,
        userId,
        deviceFrom,
      ]
    });
  } else {
    const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
    await executeQueryFromPool({
      pool: poolLocal, query: insertSql, values: [
        shipmentId,
        driverId,
        shipmentState,
        userId,
        deviceFrom,
      ]
    });
  }
}
