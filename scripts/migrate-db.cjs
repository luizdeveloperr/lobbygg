const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { rawQuery, pool } = require("../server/db");

async function run() {
  const sqlPath = path.resolve(__dirname, "../server/sql/bootstrap.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log("[🗄️] Aplicando schema PostgreSQL da Square Cloud...");
  await rawQuery(sql);
  console.log("[✅] Schema aplicado com sucesso.");

  const tablesResult = await rawQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log("[📋] Tabelas públicas disponíveis:");
  for (const row of tablesResult.rows) {
    console.log(` - ${row.table_name}`);
  }
}

run()
  .catch((error) => {
    console.error("[❌] Falha ao aplicar schema PostgreSQL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
