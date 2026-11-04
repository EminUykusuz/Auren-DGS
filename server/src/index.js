import { app } from './app.js';
import { getPool } from './db.js';
import { config } from './config.js';

await getPool();
app.listen(config.port, () => console.log(`Auren DGS API :${config.port}`));
