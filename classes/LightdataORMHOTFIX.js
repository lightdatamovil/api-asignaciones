import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * LightdataORM
 * -------------------------
 * CRUD versionado con consistencia de parámetros y logging.
 *
 * Principios:
 * - Control de versión: `superado`/`elim` + trazabilidad (`quien`)
 * - Identificadores (tabla/columnas) validados contra INFORMATION_SCHEMA (con caché)
 * - Parametrización consistente (placeholders `?`, sin db.escape)
 * - Sin manejo de transacciones (a pedido)
 *
 * Requisitos:
 * - `executeQuery` debe usar un runner de promesas (`mysql2/promise` o `conn.promise()`).
 */
export class LightdataORMHOTFIX {
    /** Caché de columnas por tabla */
    static _columnsCache = new Map();

    /** =========================
     *  Utilidades internas
     *  ========================= */
    static _assert(cond, { title, message, status = Status.badRequest }) {
        if (!cond) throw new CustomException({ title, message, status });
    }
    static _normalizeSelect(select) { return Array.isArray(select) ? select.join(", ") : (select ?? "*"); }
    static _quoteIdent(name) { return `\`${name}\``; }
    static _quoteTable(table) { return `\`${table}\``; }

    static async _getTableColumns({ db, table, log = false }) {
        if (this._columnsCache.has(table)) return this._columnsCache.get(table);
        const sql = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE();
    `;
        const rows = await executeQuery(db, sql, [table], log);
        if (!rows?.length) {
            throw new CustomException({
                title: "LightdataORM.columns",
                message: `Tabla ${table} no encontrada en INFORMATION_SCHEMA`,
                status: Status.badRequest,
            });
        }
        const cols = rows.map(r => r.COLUMN_NAME);
        this._columnsCache.set(table, cols);
        return cols;
    }

    static async _prepareColumns({ db, table, blocklist = [], log = false }) {
        const cols = await this._getTableColumns({ db, table, log });
        const set = new Set(cols);
        const validCols = cols.filter(c => !blocklist.includes(c));
        const ensure = (name) => {
            if (!set.has(name)) {
                throw new CustomException({
                    title: "LightdataORM.columns",
                    message: `Columna inválida "${name}" para tabla ${table}`,
                    status: Status.badRequest,
                });
            }
            return name;
        };
        return { validCols, ensure };
    }

    /** =========================
     *  WHERE builder
     *  ========================= */
    /**
     * Construye la cláusula WHERE a partir de un objeto.
     * Soporta arrays → `IN (...)` y múltiples condiciones con `AND`.
     *
     * @example
     * buildWhereClause({ did: [1,2], empresa_id: 5 })
     * // => { whereSql: "did IN (?, ?) AND empresa_id = ?", values: [1,2,5] }
     *
     * @param {Object} where - { columna: valor | valor[] }
     * @returns {{ whereSql: string, values: any[] }}
     */
    static buildWhereClause(where = {}) {
        const clauses = [];
        const values = [];
        for (const [col, val] of Object.entries(where)) {
            if (Array.isArray(val)) {
                clauses.push(`${col} IN (${val.map(() => "?").join(", ")})`);
                values.push(...val);
            } else {
                clauses.push(`${col} = ?`);
                values.push(val);
            }
        }
        return { whereSql: clauses.join(" AND "), values };
    }
    // helper local para aplicar alias a un where-objeto
    static _aliasWhere(where = {}, alias = "t") {
        const aliased = {};
        for (const [k, v] of Object.entries(where || {})) {
            aliased[`${alias}.${k}`] = v;
        }
        return aliased;
    }
    /** =========================
     *  SELECT
     *  ========================= */
    /**
     * Obtiene registros.
     *
     * @param {Object} opts
     * @param {Object} opts.db                 - Conexión/pool mysql2/promise o conn.promise().
     * @param {string} opts.table              - Tabla.
     * @param {Object} [opts.where={}]         - Condiciones (usa buildWhereClause).
     * @param {boolean} [opts.throwIfExists=false]      - Lanza si hay filas.
     * @param {string}  [opts.throwIfExistsMessage]     - Mensaje personalizado.
     * @param {boolean} [opts.throwIfNotExists=false]   - Lanza si no hay filas.
     * @param {string}  [opts.throwIfNotExistsMessage]  - Mensaje personalizado.
     * @param {string|string[]} [opts.select="*"]       - Columnas a seleccionar.
     * @param {boolean} [opts.includeHistorical=false]  - Incluir históricos (ignora superado/elim).
     * @param {boolean} [opts.log=false]                - Loguear queries.
     * @returns {Promise<Object[]>}
     */
    static async select({
        db,
        table,
        where = {},
        throwIfExists = false,
        throwIfExistsMessage,
        throwIfNotExists = false,
        throwIfNotExistsMessage,
        select = "*",
        includeHistorical = false,
        log = false,
    }) {
        this._assert(table, { title: "Parámetros inválidos", message: "Debes proporcionar 'table'." });

        if (Array.isArray(select)) {
            const { ensure } = await this._prepareColumns({ db, table, log });
            select.forEach(col => ensure(col));
        }

        const { whereSql, values } = this.buildWhereClause(where);
        const tableQ = this._quoteTable(table);
        const selectSql = this._normalizeSelect(select);
        const filters = includeHistorical ? "" : " AND superado = 0 AND elim = 0";

        const sql = `
      SELECT ${selectSql}
      FROM ${tableQ}
      ${whereSql ? `WHERE ${whereSql}${filters}` : `WHERE 1=1${filters}`}
    `;

        const result = await executeQuery(db, sql, values, log);

        if (throwIfExists && result.length > 0) {
            throw new CustomException({
                title: "Conflicto",
                message: throwIfExistsMessage ?? `Ya existe un registro en ${table} con esos valores`,
                status: Status.conflict,
            });
        }
        if (throwIfNotExists && result.length === 0) {
            throw new CustomException({
                title: "No encontrado",
                message: throwIfNotExistsMessage ?? `No se encontró registro en ${table} con los valores proporcionados`,
                status: Status.notFound,
            });
        }
        return result;
    }

    /** INSERT — por defecto devuelve number[] (ids nuevos).
 *  Si returnRow=true y data es un único objeto, devuelve el objeto insertado.
 *
 * @param {Object}   opts
 * @param {Object}   opts.db
 * @param {string}   opts.table
 * @param {Object|Object[]} opts.data
 * @param {number}   opts.quien
 * @param {boolean}  [opts.log=false]
 * @param {boolean}  [opts.returnRow=false]           // ⬅️ NUEVO
 * @param {string|string[]} [opts.returnSelect="*"]   // columnas a devolver si returnRow=true
 * @returns {Promise<number[] | Object>}
 */
    static async insert({
        db,
        table,
        data,
        quien,
        log = false,
        returnRow = false,            // ⬅️ nuevo
        returnSelect = "*",           // ⬅️ opcional para filtrar columnas del SELECT de retorno
    }) {
        this._assert(table && data && quien, {
            title: "LightdataORM.insert: parámetros faltantes",
            message: "Debes proporcionar 'table', 'data' y 'quien'.",
        });

        const list = Array.isArray(data) ? data : [data];

        const { validCols, ensure } = await this._prepareColumns({
            db, table, blocklist: ["id", "did", "autofecha"], log,
        });

        // Validar columnas presentes en data
        for (const row of list) {
            for (const key of Object.keys(row)) ensure(key);
        }

        const tableQ = this._quoteTable(table);
        const placeholders = `(${validCols.map(() => "?").join(", ")})`;

        const allValues = list.map(obj =>
            validCols.map(col => {
                if (col === "quien") return quien;
                if (col === "superado") return 0;
                if (col === "elim") return 0;
                return obj[col] ?? null;
            })
        );
        const flatValues = allValues.flat();

        const insertSql = `
    INSERT INTO ${tableQ} (${validCols.map(c => this._quoteIdent(c)).join(", ")})
    VALUES ${allValues.map(() => placeholders).join(", ")};
  `;

        const inserted = await executeQuery(db, insertSql, flatValues, log);
        this._assert(inserted?.affectedRows, {
            title: "Error al insertar",
            message: `No se pudo insertar en ${table}`,
            status: Status.internalServerError,
        });

        const firstId = Number(inserted.insertId);
        const ids = Array.from({ length: inserted.affectedRows }, (_, i) => firstId + i);

        // did = id
        const updDidSql = `
    UPDATE ${tableQ}
    SET did = id
    WHERE id IN (${ids.map(() => "?").join(", ")});
  `;
        await executeQuery(db, updDidSql, ids, log);

        // Retorno clásico (compat)
        if (!returnRow) return ids;

        // Si pidieron returnRow, sólo permitimos inserción de un único objeto
        if (ids.length !== 1) {
            throw new CustomException({
                title: "LightdataORM.insert",
                message: "returnRow=true requiere insertar un único registro.",
                status: Status.badRequest,
            });
        }

        // SELECT del registro recién insertado
        const rows = await this.select({
            db,
            table,
            where: { id: ids[0] },
            select: returnSelect,
            includeHistorical: false,
            log,
        });

        return rows?.[0] ?? null;
    }


    /** =========================
     *  UPDATE (versionado)
     *  ========================= */
    /**
     * Versiona uno o varios registros en batch:
     * 1) Marca previos como `superado=1` (vigentes, no eliminados)
     * 2) Inserta nuevas versiones con cambios usando `INSERT ... SELECT` + `CASE`
     *
     * Por defecto devuelve `number[]` (ids nuevos). Si `returnRows=true`, devuelve `{ ids, rows }`.
     *
     * @param {Object} opts
     * @param {Object} opts.db                        - Conexión/pool mysql2/promise o conn.promise().
     * @param {string} opts.table                     - Tabla a actualizar.
     * @param {Object} opts.where                     - Debe contener la clave de versionado (por defecto `{ did: ... }`).
     * @param {Object|Object[]} opts.data             - Nuevos datos (en el mismo orden que los ids si es array).
     * @param {number} opts.quien                     - Usuario responsable.
     * @param {string} [opts.versionKey="did"]        - Clave de versionado.
     * @param {boolean} [opts.throwIfNotExists=true]  - Lanza si no hay versiones previas vigentes.
     * @param {boolean} [opts.log=false]              - Log de queries.
     * @param {boolean} [opts.returnRows=false]       - Si true, retorna también `rows` con un SELECT posterior.
     * @param {string|string[]} [opts.returnSelect="*"]          - Columnas para el SELECT de retorno.
     * @param {boolean} [opts.returnIncludeHistorical=false]     - Incluir históricos en el SELECT de retorno.
     * @returns {Promise<number[] | {ids:number[], rows:any[]}>}
     */
    static async update({
        db,
        table,
        where,
        data,
        quien,
        versionKey = "did",
        throwIfNotExists = true,
        log = false,
        returnRow = false,                 // ⬅️ NUEVO
        returnSelect = "*",                // ⬅️ columnas a devolver si returnRow=true
    }) {
        this._assert(table && where && data && quien, {
            title: "LightdataORM.update: parámetros faltantes",
            message: "Debes proporcionar 'table', 'where', 'data' y 'quien'.",
        });

        // Extraer ids desde where[versionKey]
        const whereVal = where?.[versionKey];
        this._assert(whereVal !== undefined, {
            title: "LightdataORM.update",
            message: `Debe especificarse WHERE con la clave de versionado '${versionKey}'.`,
        });

        const idsVK = Array.isArray(whereVal)
            ? whereVal.map(Number).filter(n => Number.isFinite(n) && n > 0)
            : [Number(whereVal)];
        this._assert(idsVK.length > 0, {
            title: "LightdataORM.update",
            message: "Debe especificarse al menos un valor válido en el WHERE.",
        });

        const datas = Array.isArray(data) ? data : [data];

        const { validCols, ensure } = await this._prepareColumns({
            db, table, blocklist: ["id", "autofecha"], log,
        });

        for (const row of datas) {
            for (const key of Object.keys(row)) ensure(key);
        }

        const tableQ = this._quoteTable(table);

        // 1) Marcar previos
        const qSuperar = `
    UPDATE ${tableQ}
    SET superado = 1
    WHERE ${this._quoteIdent(versionKey)} IN (${idsVK.map(() => "?").join(", ")})
    AND elim = 0
    AND superado = 0;
  `;
        const updRes = await executeQuery(db, qSuperar, idsVK, log);

        if ((!updRes || updRes.affectedRows === 0) && throwIfNotExists) {
            throw new CustomException({
                title: "Error al versionar",
                message: `No se encontró registro previo en ${table} para versionar.`,
                status: Status.notFound,
            });
        }

        // 2) INSERT ... SELECT con CASE parametrizado
        const insertColumns = [...validCols];
        const selectPieces = [];
        const selectParams = [];

        for (const col of validCols) {
            if (col === versionKey) { selectPieces.push(this._quoteIdent(col)); continue; }
            if (col === "quien") { selectPieces.push("? AS quien"); selectParams.push(quien); continue; }
            if (col === "superado") { selectPieces.push("0 AS superado"); continue; }
            if (col === "elim") { selectPieces.push("0 AS elim"); continue; }

            const hasAny = datas.some(row => row[col] !== undefined);
            if (!hasAny) { selectPieces.push(this._quoteIdent(col)); continue; }

            const cases = [];
            for (let i = 0; i < idsVK.length; i++) {
                const v = datas[i]?.[col];
                if (v !== undefined) { cases.push(`WHEN ? THEN ?`); selectParams.push(idsVK[i], v); }
            }
            if (cases.length > 0) {
                selectPieces.push(`(CASE ${this._quoteIdent(versionKey)} ${cases.join(" ")} ELSE ${this._quoteIdent(col)} END) AS ${this._quoteIdent(col)}`);
            } else {
                selectPieces.push(this._quoteIdent(col));
            }
        }

        const subWhere = `${this._quoteIdent(versionKey)} IN (${idsVK.map(() => "?").join(", ")}) AND elim=0`;
        const valuesSub = [...idsVK];

        const baseSelect = `
    SELECT t.*
    FROM ${tableQ} t
    JOIN (
      SELECT ${this._quoteIdent(versionKey)}, MAX(id) AS max_id
      FROM ${tableQ}
      WHERE ${subWhere}
      GROUP BY ${this._quoteIdent(versionKey)}
    ) m ON m.${this._quoteIdent(versionKey)} = t.${this._quoteIdent(versionKey)} AND t.id = m.max_id
  `;

        const qInsert = `
    INSERT INTO ${tableQ} (${insertColumns.map(c => this._quoteIdent(c)).join(", ")})
    SELECT ${selectPieces.join(", ")}
    FROM (${baseSelect}) AS base
  `;

        const inserted = await executeQuery(
            db,
            qInsert,
            [...selectParams, ...valuesSub],
            log,
        );

        if ((!inserted || inserted.affectedRows === 0) && throwIfNotExists) {
            throw new CustomException({
                title: "Error al versionar",
                message: `No se pudo insertar nueva versión en ${table}.`,
                status: Status.internalServerError,
            });
        }

        const firstId = Number(inserted?.insertId);
        const idsNew =
            inserted && typeof inserted.affectedRows === "number" && Number.isFinite(firstId)
                ? Array.from({ length: inserted.affectedRows }, (_, i) => firstId + i)
                : [];

        if (!returnRow) return idsNew;

        // returnRow=true → debe haber exactamente 1 nueva fila
        if (idsNew.length !== 1) {
            throw new CustomException({
                title: "LightdataORM.update",
                message: "returnRow=true requiere afectar exactamente un registro.",
                status: Status.badRequest,
            });
        }

        const rows = await this.select({
            db,
            table,
            where: { id: idsNew[0] },
            select: returnSelect,
            includeHistorical: false,
            log,
        });

        return rows?.[0] ?? null;
    }

    /** =========================
     *  DELETE (versionado)
     *  ========================= */
    /**
     * Eliminación lógica versionada:
     * - Marca vigente como `superado=1`
     * - Inserta nueva versión con `elim=1`, copiando última versión activa
     *
     * @param {Object} opts
     * @param {Object} opts.db                     - Conexión/pool mysql2/promise o conn.promise().
     * @param {string} opts.table                  - Tabla.
     * @param {Object} opts.where                  - Condición (usa buildWhereClause).
     * @param {number} opts.quien                  - Usuario que ejecuta la acción.
     * @param {string} [opts.versionKey="did"]     - Clave de versionado.
     * @param {boolean} [opts.throwIfNotFound=false] - Lanza si no afectó filas vigentes.
     * @param {boolean} [opts.log=false]           - Log de queries.
     * @returns {Promise<void>}
     */


    static async delete({
        db,
        table,
        where,
        quien,
        versionKey = "did",
        throwIfNotFound = false,
        log = false,
    }) {
        this._assert(table && where && quien, {
            title: "LightdataORM.delete: parámetros faltantes",
            message: "Debes proporcionar 'table', 'where' y 'quien'.",
        });

        // WHERE para el UPDATE (sin alias)
        const { whereSql, values } = this.buildWhereClause(where);
        this._assert(whereSql, {
            title: "LightdataORM.delete",
            message: "Debe especificarse una condición WHERE válida.",
        });

        const { validCols } = await this._prepareColumns({
            db, table, blocklist: ["id", "autofecha"], log,
        });
        const tableQ = this._quoteTable(table);

        // 1) Marcar vigente como superado
        const qUpdate = `
    UPDATE ${tableQ}
    SET superado = 1
    WHERE ${whereSql}
    AND superado = 0 AND elim = 0;
  `;
        const updRes = await executeQuery(db, qUpdate, log);

        if (throwIfNotFound && (!updRes || updRes.affectedRows === 0)) {
            throw new CustomException({
                title: "No encontrado",
                message: `No se encontró registro vigente para eliminar en ${table}.`,
                status: Status.notFound,
            });
        }

        if (updRes?.affectedRows > 0) {
            // 👉 WHERE con alias 't.' para la subquery base (evita ambigüedad)
            const aliasedWhere = this._aliasWhere(where, "t");
            const { whereSql: whereSqlT, values: valuesT } = this.buildWhereClause(aliasedWhere);

            const insertCols = [...validCols];
            const selectCols = validCols.map(c => {
                if (c === "elim") return "1 AS elim";
                if (c === "quien") return "? AS quien";
                if (c === "superado") return "0 AS superado";
                return this._quoteIdent(c);
            });

            const baseActive = `
      SELECT t.*
      FROM ${tableQ} t
      JOIN (
        SELECT ${this._quoteIdent(versionKey)}, MAX(id) AS max_id
        FROM ${tableQ}
        WHERE elim = 0
        GROUP BY ${this._quoteIdent(versionKey)}
      ) m
        ON m.${this._quoteIdent(versionKey)} = t.${this._quoteIdent(versionKey)}
       AND t.id = m.max_id
      WHERE ${whereSqlT}   -- ⬅️ aquí va calificado con 't.'
    `;

            const qInsert = `
      INSERT INTO ${tableQ} (${insertCols.map(c => this._quoteIdent(c)).join(", ")})
      SELECT ${selectCols.join(", ")}
      FROM (${baseActive}) AS base;
    `;

            // Orden: primero quien, luego los values del WHERE con alias t.
            await executeQuery(
                db,
                qInsert,
                [quien, ...valuesT],
                log,
            );
        }
    }


    /** =========================
     *  UPSERT
     *  ========================= */
    /**
     * Si existe (según `where`), hace `update` por `versionKey`; si no, `insert`.
     * Por defecto devuelve `number[]` (ids nuevos). Si `returnRows=true`, devuelve `{ ids, rows }`.
     *
     * @param {Object} opts
     * @param {Object} opts.db                           - Conexión/pool mysql2/promise o conn.promise().
     * @param {string} opts.table                        - Tabla.
     * @param {Object} opts.where                        - Condición de existencia.
     * @param {Object|Object[]} opts.data                - Datos a insertar/actualizar.
     * @param {number} opts.quien                        - Usuario.
     * @param {string} [opts.versionKey="did"]           - Clave de versionado para el update.
     * @param {boolean} [opts.includeHistorical=false]   - Considerar históricos para detectar existencia.
     * @param {boolean} [opts.log=false]                 - Log de queries.
     * @param {boolean} [opts.returnRows=false]          - Si true, retorna también `rows`.
     * @param {string|string[]} [opts.returnSelect="*"]  - Columnas para el SELECT de retorno.
     * @param {boolean} [opts.returnIncludeHistorical=false] - Incluir históricos en el SELECT de retorno.
     * @returns {Promise<number[] | {ids:number[], rows:any[]}>}
     */
    /** UPSERT — devuelve number[] o, si returnRow=true, el objeto insertado/actualizado */
    static async upsert({
        db,
        table,
        where,
        data,
        quien,
        versionKey = "did",
        includeHistorical = false,
        log = false,
        returnRow = false,                // ⬅️ NUEVO
        returnSelect = "*",               // ⬅️ columnas si returnRow=true
    }) {
        const existing = await this.select({
            db,
            table,
            where,
            select: [versionKey],
            includeHistorical,
            log,
        });

        if (existing.length > 0) {
            const vk = existing[0][versionKey];
            // delega en update, heredando comportamiento de returnRow
            return await this.update({
                db,
                table,
                where: { [versionKey]: vk },
                data,
                quien,
                versionKey,
                log,
                returnRow,
                returnSelect,
            });
        }

        // delega en insert; si returnRow=true, insert ya devuelve el objeto
        return await this.insert({
            db,
            table,
            data,
            quien,
            log,
            returnRow,
            returnSelect,
        });
    }

}
