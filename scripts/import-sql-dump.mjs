import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const dumpPathArg = process.argv[2];

  if (!dumpPathArg) {
    throw new Error('Usage: node scripts/import-sql-dump.mjs <dump-file-path>');
  }

  const dumpPath = path.resolve(process.cwd(), dumpPathArg);
  const sql = (await fs.readFile(dumpPath, 'utf8')).replace(/^\uFEFF/, '');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log(`Imported ${dumpPath}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});