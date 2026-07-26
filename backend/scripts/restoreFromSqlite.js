require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const { DatabaseSync } = require('node:sqlite');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sourceDir: null,
    targetDb: null,
    mongoUri: process.env.MONGO_URI,
    dropFirst: true // Default to dropping existing collection to avoid unique index collisions
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sourceDir' && args[i + 1]) {
      options.sourceDir = args[++i];
    } else if (args[i] === '--targetDb' && args[i + 1]) {
      options.targetDb = args[++i];
    } else if (args[i] === '--mongoUri' && args[i + 1]) {
      options.mongoUri = args[++i];
    } else if (args[i] === '--no-drop' || args[i] === '--append') {
      options.dropFirst = false;
    } else if (args[i] === '--drop') {
      options.dropFirst = true;
    }
  }

  return options;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const HEX24_REGEX = /^[0-9a-fA-F]{24}$/;

function reviveBsonTypes(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (ISO_DATE_REGEX.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(reviveBsonTypes);
  }

  if (typeof obj === 'object') {
    // MongoDB Extended JSON formats
    if (obj.$oid && typeof obj.$oid === 'string') {
      return new ObjectId(obj.$oid);
    }
    if (obj.$date) {
      return new Date(obj.$date);
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_id' && typeof value === 'string' && HEX24_REGEX.test(value)) {
        newObj[key] = new ObjectId(value);
      } else {
        newObj[key] = reviveBsonTypes(value);
      }
    }
    return newObj;
  }

  return obj;
}

async function restoreFromSqlite() {
  const options = parseArgs();

  if (!options.mongoUri) {
    console.error('Error: MONGO_URI is missing. Set it in backend/.env or pass --mongoUri <uri>');
    process.exit(1);
  }

  const defaultBackupRoot = path.join(__dirname, '../../sqlite_backups');
  if (!fs.existsSync(defaultBackupRoot)) {
    console.error(`Error: Backup root directory '${defaultBackupRoot}' does not exist.`);
    process.exit(1);
  }

  // Determine target source directories
  let sourceDirsToProcess = [];

  if (options.sourceDir) {
    const customPath = path.resolve(process.cwd(), options.sourceDir);
    if (!fs.existsSync(customPath)) {
      console.error(`Error: Specified source directory '${customPath}' does not exist.`);
      process.exit(1);
    }
    sourceDirsToProcess.push({
      dirPath: customPath,
      dbName: options.targetDb || (path.basename(customPath).includes('Cluster0') ? 'medical_stock_system' : path.basename(customPath))
    });
  } else {
    // Auto-detect subdirectories in sqlite_backups
    const entries = fs.readdirSync(defaultBackupRoot, { withFileTypes: true });
    const subDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (subDirs.length === 0) {
      console.error('Error: No database backup folders found inside sqlite_backups/');
      process.exit(1);
    }

    for (const subDir of subDirs) {
      let targetDatabaseName = options.targetDb;
      if (!targetDatabaseName) {
        targetDatabaseName = subDir.includes('Cluster0') ? 'medical_stock_system' : subDir;
      }
      sourceDirsToProcess.push({
        dirPath: path.join(defaultBackupRoot, subDir),
        dbName: targetDatabaseName
      });
    }
  }

  console.log('[restore-sqlite] Connecting to target MongoDB Atlas database...');
  const client = new MongoClient(options.mongoUri);
  await client.connect();
  console.log('[restore-sqlite] Connected successfully to MongoDB Atlas.');

  const restorationSummary = [];

  for (const { dirPath, dbName } of sourceDirsToProcess) {
    console.log(`\n========================================`);
    console.log(`Restoring SQLite backups from '${path.basename(dirPath)}' into MongoDB database '${dbName}'`);
    console.log(`========================================`);

    const targetDb = client.db(dbName);
    const sqliteFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.sqlite'));

    if (sqliteFiles.length === 0) {
      console.log(`No .sqlite backup files found in '${dirPath}'. Skipping.`);
      continue;
    }

    for (const sqliteFile of sqliteFiles) {
      const collectionName = path.basename(sqliteFile, '.sqlite');
      const sqlitePath = path.join(dirPath, sqliteFile);

      const sqliteDb = new DatabaseSync(sqlitePath);

      // Verify table exists
      const tableCheck = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).all(collectionName);
      if (tableCheck.length === 0) {
        console.log(`  -> Skipping ${sqliteFile}: Table '${collectionName}' not found inside SQLite DB.`);
        sqliteDb.close();
        continue;
      }

      const rows = sqliteDb.prepare(`SELECT json_data FROM \`${collectionName}\``).all();

      if (rows.length > 0) {
        const mongoColl = targetDb.collection(collectionName);

        if (options.dropFirst) {
          try {
            await mongoColl.drop();
            console.log(`  -> Dropped existing '${collectionName}' collection prior to restoration.`);
          } catch (e) {
            // Collection didn't exist yet
          }
        }

        const documents = rows.map(r => reviveBsonTypes(JSON.parse(r.json_data)));

        // Bulk replace/insert
        const bulkOps = documents.map(doc => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));

        try {
          const result = await mongoColl.bulkWrite(bulkOps, { ordered: false });
          console.log(`  -> Restored '${collectionName}': ${documents.length} document(s) successfully.`);
          restorationSummary.push({
            sourceDbDir: path.basename(dirPath),
            targetDb: dbName,
            collection: collectionName,
            documentsRestored: documents.length,
            upsertedCount: result.upsertedCount || 0,
            modifiedCount: result.modifiedCount || 0,
            status: 'SUCCESS'
          });
        } catch (bulkErr) {
          const inserted = bulkErr.result ? bulkErr.result.nInserted || bulkErr.result.nUpserted : 0;
          console.warn(`  -> Partial restore for '${collectionName}': ${inserted}/${documents.length} documents (${bulkErr.message})`);
          restorationSummary.push({
            sourceDbDir: path.basename(dirPath),
            targetDb: dbName,
            collection: collectionName,
            documentsRestored: documents.length,
            upsertedCount: inserted,
            modifiedCount: 0,
            status: 'PARTIAL_SUCCESS'
          });
        }
      } else {
        console.log(`  -> Collection '${collectionName}' in SQLite is empty (0 records).`);
        restorationSummary.push({
          sourceDbDir: path.basename(dirPath),
          targetDb: dbName,
          collection: collectionName,
          documentsRestored: 0,
          upsertedCount: 0,
          modifiedCount: 0,
          status: 'EMPTY'
        });
      }

      sqliteDb.close();
    }
  }

  await client.close();
  console.log('\n[restore-sqlite] Restoration execution completed successfully!');
  console.log('Summary of database restoration into MongoDB Atlas:');
  console.table(restorationSummary);
}

if (require.main === module) {
  restoreFromSqlite().catch(err => {
    console.error('[restore-sqlite] Restoration failed:', err);
    process.exit(1);
  });
}

module.exports = { restoreFromSqlite };
