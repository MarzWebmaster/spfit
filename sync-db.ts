import { AppDataSource } from './api/config/database.ts';

async function syncDb() {
  await AppDataSource.initialize();
  console.log("Data Source has been initialized!");
  await AppDataSource.synchronize(false);
  console.log("Database schema synchronized!");
  process.exit(0);
}

syncDb().catch(err => {
  console.error(err);
  process.exit(1);
});
