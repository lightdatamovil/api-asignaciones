import { executeQueryFromPool } from "../../db.js";
import { logGreen } from "./logsCustom.js";

export async function crearLog(
  empresa,
  usuario,
  perfil,
  body,
  tiempo,
  resultado,
  endpoint,
  metodo,
  exito
) {
  const sqlLog = `INSERT INTO logs_v2 (empresa, usuario, perfil, body, tiempo, resultado, endpoint, metodo, exito) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    empresa,
    usuario,
    perfil,
    JSON.stringify(body),
    tiempo,
    JSON.stringify(resultado),
    endpoint,
    metodo,
    exito,
  ];

  await executeQueryFromPool(sqlLog, values);
  logGreen(`Log creado: ${JSON.stringify(values)}`);
}
