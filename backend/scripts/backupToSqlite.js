require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { DatabaseSync } = require('node:sqlite');

const mongoUri = process.env.MONGO_URI;

const BACKUP_ROOT = path.join(__dirname, '../../sqlite_backups');

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSqliteType(val) {
  if (val === null || val === undefined) return 'TEXT';
  if (typeof val === 'number') return Number.isInteger(val) ? 'INTEGER' : 'REAL';
  if (typeof val === 'boolean') return 'INTEGER';
  return 'TEXT';
}

function formatValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'object') {
    if (val._bsontype === 'ObjectID' || val.constructor?.name === 'ObjectId') return val.toString();
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val);
  }
  return val;
}

async function runBackup() {
  const currentUri = process.env.MONGO_URI || mongoUri;
  if (!currentUri) {
    console.error('Error: MONGO_URI not found in backend/.env');
    throw new Error('MONGO_URI missing');
  }

  console.log('[sqlite-backup] Connecting to MongoDB...');
  const client = new MongoClient(currentUri);
  await client.connect();
  console.log('[sqlite-backup] Connected successfully to MongoDB server.');

  const adminDb = client.db('admin');
  const dbsResult = await adminDb.admin().listDatabases();
  const targetDbs = dbsResult.databases
    .map(d => d.name)
    .filter(name => !['admin', 'local', 'config'].includes(name));

  console.log(`[sqlite-backup] Found ${targetDbs.length} non-system database(s):`, targetDbs);

  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }

  const summary = [];

  for (const dbName of targetDbs) {
    console.log(`\n[sqlite-backup] Processing Database: ${dbName}`);

    const dbSanitized = sanitizeName(dbName);
    const dbDir = path.join(BACKUP_ROOT, dbSanitized);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const currentDb = client.db(dbName);
    const collections = await currentDb.listCollections().toArray();
    console.log(`[sqlite-backup] Found ${collections.length} collection(s) in '${dbName}'.`);

    for (const collInfo of collections) {
      const collName = collInfo.name;
      const collSanitized = sanitizeName(collName);
      const sqliteFilePath = path.join(dbDir, `${collSanitized}.sqlite`);

      // Delete existing backup file if present
      if (fs.existsSync(sqliteFilePath)) {
        fs.unlinkSync(sqliteFilePath);
      }

      const docs = await currentDb.collection(collName).find({}).toArray();
      console.log(`  -> Collection '${collName}': ${docs.length} document(s) -> '${collSanitized}.sqlite'`);

      const sqliteDb = new DatabaseSync(sqliteFilePath);

      // Collect top-level fields across all documents
      const fieldMap = new Map();
      fieldMap.set('_id', 'TEXT');
      fieldMap.set('json_data', 'TEXT');

      for (const doc of docs) {
        for (const [key, val] of Object.entries(doc)) {
          if (key === '_id' || key === 'json_data') continue;
          const cleanKey = sanitizeName(key);
          if (!fieldMap.has(cleanKey)) {
            fieldMap.set(cleanKey, getSqliteType(val));
          }
        }
      }

      // Build CREATE TABLE statement
      const columnDefs = Array.from(fieldMap.entries())
        .map(([col, type]) => {
          if (col === '_id') return '`_id` TEXT PRIMARY KEY';
          return `\`${col}\` ${type}`;
        })
        .join(', ');

      const tableName = collSanitized;
      sqliteDb.exec(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs});`);

      // Insert documents
      if (docs.length > 0) {
        const colNames = Array.from(fieldMap.keys());
        const placeholders = colNames.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO \`${tableName}\` (${colNames.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders});`;
        const insertStmt = sqliteDb.prepare(insertSql);

        for (const doc of docs) {
          const rowValues = colNames.map(colName => {
            if (colName === '_id') return doc._id ? doc._id.toString() : '';
            if (colName === 'json_data') return JSON.stringify(doc);

            // Find matching original key
            const origKey = Object.keys(doc).find(k => sanitizeName(k) === colName);
            if (origKey !== undefined) {
              return formatValue(doc[origKey]);
            }
            return null;
          });

          insertStmt.run(...rowValues);
        }
      }

      const fileStats = fs.statSync(sqliteFilePath);
      summary.push({
        database: dbName,
        collection: collName,
        sqliteFile: path.relative(path.join(__dirname, '../..'), sqliteFilePath),
        docCount: docs.length,
        fileSizeBytes: fileStats.size
      });

      sqliteDb.close();
    }
  }

  await client.close();
  console.log('\n[sqlite-backup] Backup complete! Summary of SQLite databases created:');
  console.table(summary);

  // Write summary manifest JSON file
  const manifestPath = path.join(BACKUP_ROOT, 'backup_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalDatabases: targetDbs.length,
    summary
  }, null, 2));

  console.log(`[sqlite-backup] Manifest saved to: ${manifestPath}`);
  return summary;
}

if (require.main === module) {
  runBackup().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
}

module.exports = { runBackup };
