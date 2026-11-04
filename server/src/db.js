import { config } from './config.js';

// DB_USER verilmişse SQL Login, yoksa Windows Authentication (msnodesqlv8).
let sql, pool;
export async function getPool(database = config.db.database) {
  if (pool && database === config.db.database) return pool;
  const { server, user, password } = config.db;
  let p;
  if (user) {
    sql = (await import('mssql')).default;
    p = new sql.ConnectionPool({ server, user, password, database, options: { encrypt: true, trustServerCertificate: true }, pool: { max: 10 } });
  } else {
    sql = (await import('mssql/msnodesqlv8.js')).default;
    p = new sql.ConnectionPool({
      connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
      pool: { max: 10 },
    });
  }
  await p.connect();
  if (database === config.db.database) pool = p;
  return p;
}
export const types = () => sql;

// Yalnızca parametreli sorgu. params: { ad: değer } veya { ad: [tip, değer] }
export async function query(text, params = {}, runner) {
  const pl = runner ?? (await getPool());
  const req = pl.request ? pl.request() : new sql.Request(pl);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) req.input(k, v[0], v[1]); else req.input(k, v);
  }
  const r = await req.query(text);
  return r.recordset ?? [];
}

export async function tx(fn) {
  const p = await getPool();
  const t = new sql.Transaction(p);
  await t.begin();
  try {
    const out = await fn((text, params) => query(text, params, t));
    await t.commit();
    return out;
  } catch (e) { await t.rollback().catch(() => {}); throw e; }
}
