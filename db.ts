import { Pool } from "pg";
import { config } from './config.js';

if (!config.database.url) {
  throw new Error(
    "Database URL must be configured in config.ts"
  );
}

export const db = new Pool({
  connectionString: config.database.url
});
