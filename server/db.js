const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function resolveFilePath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function readOptionalFile(filePath) {
  const resolved = resolveFilePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved, "utf8");
}

function splitTopLevel(input) {
  const text = String(input || "").trim();
  if (!text) return [];

  const parts = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function createNoRowsError() {
  return {
    code: "PGRST116",
    message: "JSON object requested, multiple (or no) rows returned",
  };
}

function buildWhereClause(filters) {
  const values = [];
  const clauses = [];

  const pushValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const buildBasicClause = (column, operator, value) => {
    const qualifiedColumn = `t.${quoteIdentifier(column)}`;

    if (value === null) {
      if (operator === "=") return `${qualifiedColumn} IS NULL`;
      if (operator === "!=") return `${qualifiedColumn} IS NOT NULL`;
    }

    const placeholder = pushValue(value);
    return `${qualifiedColumn} ${operator} ${placeholder}`;
  };

  const buildOrClause = (expression) => {
    const segments = splitTopLevel(expression);
    const parts = [];

    for (const segment of segments) {
      const match = /^([a-zA-Z_][\w]*)\.(lt|lte|gt|gte|eq|neq|is)\.(.+)$/.exec(segment);
      if (!match) continue;

      const [, column, rawOperator, rawValue] = match;

      if (rawOperator === "is") {
        if (rawValue === "null") {
          parts.push(`t.${quoteIdentifier(column)} IS NULL`);
        } else if (rawValue === "not.null") {
          parts.push(`t.${quoteIdentifier(column)} IS NOT NULL`);
        }
        continue;
      }

      const operatorMap = {
        eq: "=",
        neq: "!=",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
      };

      parts.push(buildBasicClause(column, operatorMap[rawOperator], rawValue));
    }

    if (parts.length) {
      clauses.push(`(${parts.join(" OR ")})`);
    }
  };

  for (const filter of filters) {
    if (filter.type === "or") {
      buildOrClause(filter.expression);
      continue;
    }

    clauses.push(buildBasicClause(filter.column, filter.operator, filter.value));
  }

  return {
    clause: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function buildOrderClause(orders) {
  if (!orders.length) return "";

  const parts = orders.map(({ column, ascending = true, nullsFirst }) => {
    const direction = ascending ? "ASC" : "DESC";
    let nulls = "";

    if (nullsFirst === true) nulls = " NULLS FIRST";
    if (nullsFirst === false) nulls = " NULLS LAST";

    return `t.${quoteIdentifier(column)} ${direction}${nulls}`;
  });

  return ` ORDER BY ${parts.join(", ")}`;
}

function parseSelectSpec(table, selection) {
  const normalizedSelection = String(selection || "*").trim() || "*";
  const tokens = splitTopLevel(normalizedSelection);
  const baseColumns = [];
  const selectParts = [];
  const joins = [];
  let hasWildcard = false;
  let includesReviewUser = false;

  for (const token of tokens.length ? tokens : ["*"]) {
    if (token === "*") {
      hasWildcard = true;
      selectParts.push("t.*");
      continue;
    }

    const relationMatch = /^([a-zA-Z_][\w]*):([a-zA-Z_][\w]*)\((.+)\)$/.exec(token);
    if (relationMatch && table === "reviews" && relationMatch[2] === "users") {
      const alias = relationMatch[1];
      const innerColumns = splitTopLevel(relationMatch[3]);
      joins.push(` LEFT JOIN "users" review_user ON review_user."id" = t."user_id"`);
      selectParts.push(
        `json_build_object(${innerColumns
          .map((column) => `'${column}', review_user.${quoteIdentifier(column)}`)
          .join(", ")}) AS ${quoteIdentifier(alias)}`
      );
      includesReviewUser = true;
      continue;
    }

    baseColumns.push(token);
    selectParts.push(`t.${quoteIdentifier(token)}`);
  }

  return {
    normalizedSelection,
    hasWildcard,
    includesReviewUser,
    baseColumns,
    selectSql: selectParts.join(", ") || "t.*",
    joins: joins.join(""),
  };
}

function projectSimpleRows(rows, selection) {
  const normalizedSelection = String(selection || "*").trim() || "*";
  if (normalizedSelection === "*") return rows;

  const tokens = splitTopLevel(normalizedSelection);
  const plainTokens = tokens.filter((token) => !token.includes(":"));
  if (!plainTokens.length) return rows;

  return rows.map((row) => {
    const projected = {};
    for (const token of plainTokens) {
      projected[token] = row[token];
    }
    return projected;
  });
}

class QueryBuilder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.mode = "select";
    this.selection = "*";
    this.selectOptions = {};
    this.returningSelection = null;
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.payload = null;
    this.upsertOptions = {};
    this.singleMode = null;
  }

  select(selection = "*", options = {}) {
    if (this.mode === "select") {
      this.selection = selection;
      this.selectOptions = options;
    } else {
      this.returningSelection = selection;
    }
    return this;
  }

  insert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  upsert(payload, options = {}) {
    this.mode = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    this.upsertOptions = options;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: "basic", column, operator: "=", value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: "basic", column, operator: "!=", value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: "basic", column, operator: ">", value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: "basic", column, operator: ">=", value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: "basic", column, operator: "<", value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: "basic", column, operator: "<=", value });
    return this;
  }

  or(expression) {
    this.filters.push({ type: "or", expression });
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ...options });
    return this;
  }

  limit(limitValue) {
    this.limitValue = Number(limitValue);
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    try {
      const result = await this._execute();
      return result;
    } catch (error) {
      return { data: null, error };
    }
  }

  async _execute() {
    switch (this.mode) {
      case "select":
        return this.executeSelect();
      case "insert":
        return this.executeInsert();
      case "update":
        return this.executeUpdate();
      case "delete":
        return this.executeDelete();
      case "upsert":
        return this.executeUpsert();
      default:
        throw new Error(`Unsupported query mode: ${this.mode}`);
    }
  }

  finalizeRows(rows, extra = {}) {
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return { data: null, error: createNoRowsError(), ...extra };
      }
      return { data: rows[0], error: null, ...extra };
    }

    if (this.singleMode === "maybeSingle") {
      if (rows.length > 1) {
        return { data: null, error: createNoRowsError(), ...extra };
      }
      return { data: rows[0] || null, error: null, ...extra };
    }

    return { data: rows, error: null, ...extra };
  }

  async executeSelect() {
    const { clause, values } = buildWhereClause(this.filters);

    if (this.selectOptions?.head && this.selectOptions?.count === "exact") {
      const sql = `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(this.table)} t${clause}`;
      const result = await this.pool.query(sql, values);
      return { data: null, error: null, count: result.rows[0]?.count || 0 };
    }

    const selectSpec = parseSelectSpec(this.table, this.selection);
    const orderClause = buildOrderClause(this.orders);
    const limitClause =
      Number.isFinite(this.limitValue) && this.limitValue >= 0 ? ` LIMIT ${this.limitValue}` : "";

    const sql = `SELECT ${selectSpec.selectSql} FROM ${quoteIdentifier(this.table)} t${selectSpec.joins}${clause}${orderClause}${limitClause}`;
    const result = await this.pool.query(sql, values);
    return this.finalizeRows(result.rows);
  }

  buildInsertParts() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const columns = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row || {})))
    );

    const values = [];
    const valueGroups = rows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row?.[column] ?? null);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    return {
      columns,
      values,
      valuesSql: valueGroups.join(", "),
    };
  }

  async loadReturningRows(rows) {
    const selection = this.returningSelection || "*";
    if (!rows.length) return rows;

    if (selection.includes(":") && rows.length === 1 && rows[0]?.id) {
      const nested = await new QueryBuilder(this.pool, this.table)
        .select(selection)
        .eq("id", rows[0].id)
        .single();
      if (!nested.error) return [nested.data];
    }

    return projectSimpleRows(rows, selection);
  }

  async executeInsert() {
    const { columns, values, valuesSql } = this.buildInsertParts();
    const returningSql = this.returningSelection ? " RETURNING *" : "";
    const sql = `INSERT INTO ${quoteIdentifier(this.table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${valuesSql}${returningSql}`;
    const result = await this.pool.query(sql, values);
    const data = this.returningSelection ? await this.loadReturningRows(result.rows) : null;
    return this.finalizeRows(data || []);
  }

  async executeUpdate() {
    const payload = this.payload || {};
    const entries = Object.entries(payload);
    const values = [];
    const sets = entries.map(([column, value]) => {
      values.push(value);
      return `${quoteIdentifier(column)} = $${values.length}`;
    });

    const where = buildWhereClause(this.filters);
    const adjustedWhereClause = where.clause.replace(/\$(\d+)/g, (_, index) => `$${Number(index) + values.length}`);
    const returningSql = this.returningSelection ? " RETURNING *" : "";
    const sql = `UPDATE ${quoteIdentifier(this.table)} SET ${sets.join(", ")}${adjustedWhereClause}${returningSql}`;
    const result = await this.pool.query(sql, [...values, ...where.values]);
    const data = this.returningSelection ? await this.loadReturningRows(result.rows) : null;
    return this.finalizeRows(data || []);
  }

  async executeDelete() {
    const where = buildWhereClause(this.filters);
    const returningSql = this.returningSelection ? " RETURNING *" : "";
    const sql = `DELETE FROM ${quoteIdentifier(this.table)}${where.clause.replace(/\bt\./g, "")}${returningSql}`;
    const result = await this.pool.query(sql, where.values);
    const data = this.returningSelection ? await this.loadReturningRows(result.rows) : null;
    return this.finalizeRows(data || []);
  }

  async executeUpsert() {
    const { columns, values, valuesSql } = this.buildInsertParts();
    const conflictColumns = splitTopLevel(this.upsertOptions.onConflict || "").filter(Boolean);
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    const updateSql = updateColumns.length
      ? `DO UPDATE SET ${updateColumns
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(", ")}`
      : "DO NOTHING";
    const returningSql = this.returningSelection ? " RETURNING *" : "";

    const sql = `INSERT INTO ${quoteIdentifier(this.table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${valuesSql} ON CONFLICT (${conflictColumns
      .map(quoteIdentifier)
      .join(", ")}) ${updateSql}${returningSql}`;

    const result = await this.pool.query(sql, values);
    const data = this.returningSelection ? await this.loadReturningRows(result.rows) : null;
    return this.finalizeRows(data || []);
  }
}

const connectionString = String(process.env.DATABASE_URL || "").trim();
const certDir = resolveFilePath(process.env.PGSSL_CERT_DIR || path.join(__dirname, "certs"));
const caPath = process.env.PGSSL_CA_PATH || path.join(certDir, "ca-certificate.crt");
const certPath = process.env.PGSSL_CERT_PATH || path.join(certDir, "certificate.pem");
const keyPath = process.env.PGSSL_KEY_PATH || path.join(certDir, "private-key.key");

if (!connectionString) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: String(process.env.PGSSL_REJECT_UNAUTHORIZED || "true") !== "false",
    ca: readOptionalFile(caPath) || undefined,
    cert: readOptionalFile(certPath) || undefined,
    key: readOptionalFile(keyPath) || undefined,
  },
});

pool.on("error", (error) => {
  console.error("[❌] Erro inesperado no pool PostgreSQL:", error);
});

const pgClient = {
  from(table) {
    return new QueryBuilder(pool, table);
  },
};

async function rawQuery(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  rawQuery,
  pgClient,
};
