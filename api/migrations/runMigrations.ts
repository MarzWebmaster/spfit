import * as fs from 'fs';
import * as path from 'path';
import type { DataSource } from 'typeorm';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runMigrations(dataSource?: DataSource) {
  try {
    console.log('🔄 Starting database migrations...');

    const ds = dataSource ?? (await import('../config/database.ts')).AppDataSource;

    // Initialize database connection if not already
    if (!ds.isInitialized) {
      await ds.initialize();
      console.log('✅ Database connection established');
    }

    await ds.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const appliedRows = await ds.query('SELECT file_name FROM schema_migrations');
    const appliedFiles = new Set(
      Array.isArray(appliedRows)
        ? appliedRows.map((row: any) => String(row.file_name || '').trim()).filter(Boolean)
        : []
    );

    // Read and execute all SQL migration files in order
    const migrationsDir = path.join(process.cwd(), 'api', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // rely on numeric prefix (001_, 002_, 003_...)

    console.log(`📝 Found ${migrationFiles.length} migration file(s):`, migrationFiles);

    let executedFiles = 0;
    let skippedFiles = 0;

    for (const file of migrationFiles) {
      if (appliedFiles.has(file)) {
        console.log(`⏭️  Skipping previously applied migration ${file}`);
        skippedFiles++;
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      const statements = sqlContent
        .split(';')
        .map(stmt => {
            // Remove comments line by line to prevent filtering out valid statements that start with comments
            return stmt.split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n')
                .trim();
        })
        .filter(stmt => stmt.length > 0);

      console.log(`📝 Executing ${statements.length} statement(s) from ${file}...`);

      let fileHadWork = false;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const maxRetries = 3;
            let lastError: any;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                await ds.query(statement);
                lastError = null;
                break;
              } catch (error: any) {
                lastError = error;
                const isTransientLockError = error?.errno === 1213 || error?.errno === 1205;
                if (!isTransientLockError || attempt === maxRetries) {
                  throw error;
                }

                const retryDelayMs = attempt * 400;
                console.warn(`⚠️  ${file} - statement ${i + 1}/${statements.length} retry ${attempt}/${maxRetries} selepas lock error (${error.errno}).`);
                await wait(retryDelayMs);
              }
            }

            if (lastError) {
              throw lastError;
            }

            fileHadWork = true;
            console.log(`✅ ${file} - statement ${i + 1}/${statements.length} executed successfully`);
          } catch (error: any) {
            // Ignore specific errors to make migrations idempotent
            const IGNORABLE_ERRORS = [
                1050, // Table already exists
              1051, // Unknown table (DROP TABLE when table already removed)
                1060, // Duplicate column name
                1061, // Duplicate key name
                1062, // Duplicate entry
                1091, // Can't DROP 'x'; check that column/key exists
                1072, // Key column doesn't exist in table (idempotent FK/index statements)
                1054, // Unknown column (sometimes happens in DROP if not exists or using dropped col)
                1146, // Table doesn't exist (for DROP TABLE)
                1022, // Duplicate key (Can't write; duplicate key in table)
                1826, // Duplicate foreign key constraint name
                1213, // Deadlock found when trying to get lock
                1205, // Lock wait timeout exceeded
            ];

            if (IGNORABLE_ERRORS.includes(error.errno)) {
                fileHadWork = true;
                console.warn(`⚠️  ${file} - statement ${i + 1}/${statements.length} skipped (Error ${error.errno}: ${error.sqlMessage})`);
            } else {
                console.error(`❌ Error executing ${file} statement ${i + 1}:`, error);
                console.error('Statement:', statement);
                throw error;
            }
          }
        }
      }

      await ds.query('INSERT INTO schema_migrations (file_name) VALUES (?)', [file]);
      appliedFiles.add(file);
      if (fileHadWork) {
        executedFiles++;
      }
    }

    console.log(`🎉 Migrations completed. Applied this run: ${executedFiles}, previously applied: ${skippedFiles}.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Export the function for use in other modules
// Note: Auto-execution removed to prevent process.exit when imported
