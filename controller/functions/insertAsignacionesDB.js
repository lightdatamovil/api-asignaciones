import { executeQueryFromPool } from "../../db.js";

export async function insertAsignacionesDB(
  companyId,
  shipmentId,
  driverId,
  shipmentState,
  userId,
  deviceFrom
) {

  const checkSql = `SELECT id FROM asignaciones_${companyId} WHERE didenvio = ? AND superado = 0`;
  const existingRecords = await executeQueryFromPool(checkSql, [
    shipmentId,
  ]);

  if (existingRecords.length > 0) {
    const updateSql = `UPDATE asignaciones_${companyId} SET superado = 1 WHERE id = ?`;
    await executeQueryFromPool(updateSql, [existingRecords[0].id]);

    const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
    await executeQueryFromPool(insertSql, [
      shipmentId,
      driverId,
      shipmentState,
      userId,
      deviceFrom,
    ]);
  } else {
    const insertSql = `INSERT INTO asignaciones_${companyId} (didenvio, chofer, estado, quien, desde) VALUES (?, ?, ?, ?, ?)`;
    await executeQueryFromPool(insertSql, [
      shipmentId,
      driverId,
      shipmentState,
      userId,
      deviceFrom,
    ]);
  }
}
