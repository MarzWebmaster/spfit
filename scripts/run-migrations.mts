import { AppDataSource, runMigrations } from '../api/config/database.ts';

async function main() {
  try {
    await runMigrations();
    console.log('Migration run completed');
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('Migration run failed:', error);
  process.exit(1);
});
