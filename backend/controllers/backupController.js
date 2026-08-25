const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const FILE_RE = /^bcml-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/;

const ensureDir = () => fs.mkdirSync(BACKUP_DIR, { recursive: true });

const safeName = (name) => {
  if (!FILE_RE.test(name)) throw new ApiError(400, 'Invalid backup file name.');
  const full = path.join(BACKUP_DIR, name);
  if (!full.startsWith(BACKUP_DIR) || !fs.existsSync(full)) throw new ApiError(404, 'Backup file not found.');
  return full;
};

// Collections that are always part of a backup, in restore-safe order
const COLLECTION_ORDER = [
  'Setting', 'Role', 'User', 'Counter', 'Category', 'Supplier', 'Customer',
  'Product', 'StockTransaction', 'Order', 'Sale', 'Payment', 'Loan',
  'Notification', 'AuditLog'
];

exports.create = wrapAsync(async (req, res) => {
  ensureDir();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const fileName = `bcml-backup-${stamp}.json`;

  const modelNames = mongoose.modelNames();
  const ordered = [
    ...COLLECTION_ORDER.filter((m) => modelNames.includes(m)),
    ...modelNames.filter((m) => !COLLECTION_ORDER.includes(m))
  ];

  const data = {};
  const counts = {};
  for (const name of ordered) {
    // Include private fields (e.g. hashed passwords) so credentials survive a restore
    const query = mongoose.model(name).find({});
    if (name === 'User') query.select('+password');
    const docs = await query.lean();
    data[name] = docs;
    counts[name] = docs.length;
  }

  const payload = {
    meta: {
      app: 'Brilliant Construction & Materials Ltd — Stock Management',
      createdAt: now.toISOString(),
      createdBy: req.user ? `${req.user.fullName} (@${req.user.username})` : 'System',
      counts
    },
    data
  };

  fs.writeFileSync(path.join(BACKUP_DIR, fileName), JSON.stringify(payload));
  const sizeKb = Math.round(fs.statSync(path.join(BACKUP_DIR, fileName)).size / 1024);

  await logAction({
    user: req.user, action: ACTIONS.BACKUP_CREATE, entity: 'Backup', entityId: fileName,
    description: `Created database backup "${fileName}" (${sizeKb} KB, ${Object.values(counts).reduce((a, b) => a + b, 0)} documents).`
  });
  res.status(201).json({ success: true, message: 'Backup created', data: { fileName, sizeKb, counts } });
});

exports.list = wrapAsync(async (req, res) => {
  ensureDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => FILE_RE.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { fileName: f, sizeKb: Math.round(st.size / 1024), createdAt: st.mtime };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: { backups: files } });
});

exports.download = wrapAsync(async (req, res) => {
  const full = safeName(req.params.fileName);
  await logAction({
    user: req.user, action: ACTIONS.BACKUP_DOWNLOAD, entity: 'Backup', entityId: req.params.fileName,
    description: `Downloaded backup "${req.params.fileName}".`
  });
  res.download(full);
});

exports.remove = wrapAsync(async (req, res) => {
  safeName(req.params.fileName);
  fs.unlinkSync(path.join(BACKUP_DIR, req.params.fileName));
  await logAction({
    user: req.user, action: ACTIONS.BACKUP_DELETE, entity: 'Backup', entityId: req.params.fileName,
    description: `Deleted backup "${req.params.fileName}".`
  });
  res.json({ success: true, message: 'Backup deleted' });
});

exports.restore = wrapAsync(async (req, res) => {
  let raw;
  let source;
  if (req.file?.buffer) {
    raw = req.file.buffer.toString('utf8');
    source = req.file.originalname;
  } else if (req.body?.fileName) {
    raw = fs.readFileSync(safeName(req.body.fileName), 'utf8');
    source = req.body.fileName;
  } else {
    throw new ApiError(400, 'Provide an uploaded backup file or an existing fileName.');
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'The file is not valid JSON.');
  }
  if (!payload?.meta || !payload?.data || typeof payload.data !== 'object') {
    throw new ApiError(400, 'This file is not a valid system backup.');
  }

  const modelNames = mongoose.modelNames();
  const entries = Object.entries(payload.data)
    .filter(([name, docs]) => modelNames.includes(name) && Array.isArray(docs));
  if (!entries.length) throw new ApiError(400, 'Backup contains no recognizable collections.');

  // Safety: never wipe the database unless the backup includes user accounts,
  // otherwise nobody could log in afterwards.
  const userEntry = entries.find(([name]) => name === 'User');
  if (!userEntry || userEntry[1].length === 0 || userEntry[1].some((u) => !u.password)) {
    throw new ApiError(400, 'Refusing to restore: backup has no complete user accounts (this would lock everyone out). Use a newer backup.');
  }

  const results = [];
  const failures = [];

  const applyRestore = async (session) => {
    for (const [name, docs] of entries) {
      // The audit trail is append-only: it is never overwritten by a restore,
      // so accountability survives any data recovery.
      if (name === 'AuditLog') continue;
      const Model = mongoose.model(name);
      await Model.deleteMany({}, { session });
      let inserted = 0;
      if (docs.length) {
        try {
          const written = await Model.insertMany(docs, { ordered: false, session });
          inserted = Array.isArray(written) ? written.length : docs.length;
        } catch (err) {
          inserted = err.insertedDocs?.length || 0;
          failures.push({ collection: name, error: err.message?.slice(0, 200) });
        }
        if (inserted < docs.length) {
          failures.push({ collection: name, error: `${docs.length - inserted} document(s) could not be restored` });
        }
      }
      results.push({ collection: name, restored: inserted });
    }
  };

  // Run inside a transaction: either every collection is replaced or nothing changes.
  try {
    await mongoose.connection.transaction(applyRestore);
  } catch (err) {
    throw new ApiError(500, `Restore failed and was rolled back: ${err.message?.slice(0, 150)}`);
  }

  if (failures.length && results.find((r) => r.collection === 'User')?.restored === 0) {
    throw new ApiError(500, `Restore failed for users collection: ${failures[0].error}`);
  }

  await logAction({
    user: req.user, action: ACTIONS.BACKUP_RESTORE, entity: 'Backup', entityId: source,
    description: `RESTORED database from backup "${source}" (${payload.meta.createdAt || 'unknown date'}). Data collections were replaced; audit trail preserved.${failures.length ? ` WARNING: ${failures.length} partial failure(s).` : ''}`
  });
  res.json({
    success: true,
    message: failures.length
      ? `Database restored with ${failures.length} warning(s): ${failures.map((f) => `${f.collection}: ${f.error}`).join('; ').slice(0, 300)}`
      : 'Database restored successfully.',
    data: { source, results, failures }
  });
});
