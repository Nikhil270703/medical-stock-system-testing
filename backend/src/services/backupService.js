const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Import models
const User = require('../models/user');
const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const Order = require('../models/order');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Payment = require('../models/payment');
const Branch = require('../models/branch');
const Employee = require('../models/employee');
const PurchaseOrder = require('../models/purchaseOrder');
const StockAdjustment = require('../models/stockAdjustment');
const Expense = require('../models/expense');
const Setting = require('../models/setting');
const AuditLog = require('../models/auditLog');

const Category = require('../models/category');
const Unit = require('../models/unit');
const HsnCode = require('../models/hsnCode');
const Notification = require('../models/notification');

// Fetches all database contents and returns a serialized JSON object
const generateDatabaseDump = async () => {
  return {
    branches: await Branch.find({}),
    users: await User.find({}),
    employees: await Employee.find({}),
    categories: await Category.find({}),
    units: await Unit.find({}),
    hsnCodes: await HsnCode.find({}),
    customers: await Customer.find({}),
    vendors: await Vendor.find({}),
    products: await Product.find({}),
    stockHistory: await StockHistory.find({}),
    orders: await Order.find({}),
    quotations: await Quotation.find({}),
    bills: await Bill.find({}),
    payments: await Payment.find({}),
    purchaseOrders: await PurchaseOrder.find({}),
    stockAdjustments: await StockAdjustment.find({}),
    expenses: await Expense.find({}),
    settings: await Setting.find({}),
    notifications: await Notification.find({}),
    auditLogs: await AuditLog.find({})
  };
};

// Writes the database dump to a local JSON backup file
const performBackup = async () => {
  console.log('[backup-service] Starting database backup...');
  try {
    const data = await generateDatabaseDump();
    const backupDir = path.join(__dirname, '../../backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const filename = `backup_${timestamp}.json`;
    const filePath = path.join(backupDir, filename);

    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonStr);
    console.log(`[backup-service] Backup completed successfully. Saved locally: ${filePath}`);

    const stats = fs.statSync(filePath);
    return {
      filename,
      filePath,
      sizeBytes: stats.size,
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      createdAt: stats.birthtime || new Date()
    };
  } catch (err) {
    console.error('[backup-service] Backup run failed:', err.message);
    throw err;
  }
};

const getBackupHistory = async () => {
  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    return [];
  }
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  const history = files.map(filename => {
    const filePath = path.join(backupDir, filename);
    const stats = fs.statSync(filePath);
    return {
      filename,
      sizeBytes: stats.size,
      sizeKB: (stats.size / 1024).toFixed(1),
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      createdAt: stats.birthtime || stats.mtime
    };
  });
  return history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Restore database from dump object
const restoreDatabaseDump = async (dump) => {
  console.log('[backup-service] Restoring database from upload dump...');
  
  // Destructive wipe
  await Branch.deleteMany({});
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Category.deleteMany({});
  await Unit.deleteMany({});
  await HsnCode.deleteMany({});
  await Customer.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await StockHistory.deleteMany({});
  await Order.deleteMany({});
  await Quotation.deleteMany({});
  await Bill.deleteMany({});
  await Payment.deleteMany({});
  await PurchaseOrder.deleteMany({});
  await StockAdjustment.deleteMany({});
  await Expense.deleteMany({});
  await Setting.deleteMany({});
  await Notification.deleteMany({});
  await AuditLog.deleteMany({});

  // Restore collections
  if (dump.branches && dump.branches.length) await Branch.insertMany(dump.branches);
  if (dump.users && dump.users.length) await User.insertMany(dump.users);
  if (dump.employees && dump.employees.length) await Employee.insertMany(dump.employees);
  if (dump.categories && dump.categories.length) await Category.insertMany(dump.categories);
  if (dump.units && dump.units.length) await Unit.insertMany(dump.units);
  if (dump.hsnCodes && dump.hsnCodes.length) await HsnCode.insertMany(dump.hsnCodes);
  if (dump.customers && dump.customers.length) await Customer.insertMany(dump.customers);
  if (dump.vendors && dump.vendors.length) await Vendor.insertMany(dump.vendors);
  if (dump.products && dump.products.length) await Product.insertMany(dump.products);
  if (dump.stockHistory && dump.stockHistory.length) await StockHistory.insertMany(dump.stockHistory);
  if (dump.orders && dump.orders.length) await Order.insertMany(dump.orders);
  if (dump.quotations && dump.quotations.length) await Quotation.insertMany(dump.quotations);
  if (dump.bills && dump.bills.length) await Bill.insertMany(dump.bills);
  if (dump.payments && dump.payments.length) await Payment.insertMany(dump.payments);
  if (dump.purchaseOrders && dump.purchaseOrders.length) await PurchaseOrder.insertMany(dump.purchaseOrders);
  if (dump.stockAdjustments && dump.stockAdjustments.length) await StockAdjustment.insertMany(dump.stockAdjustments);
  if (dump.expenses && dump.expenses.length) await Expense.insertMany(dump.expenses);
  if (dump.settings && dump.settings.length) await Setting.insertMany(dump.settings);
  if (dump.notifications && dump.notifications.length) await Notification.insertMany(dump.notifications);
  if (dump.auditLogs && dump.auditLogs.length) await AuditLog.insertMany(dump.auditLogs);

  console.log('[backup-service] Database restore execution completed.');
};

const initBackupCron = () => {
  cron.schedule('0 2 * * *', () => {
    performBackup();
  });
  console.log('[backup-service] Nightly backup cron scheduler initialized successfully.');
};

module.exports = {
  initBackupCron,
  performBackup,
  generateDatabaseDump,
  getBackupHistory,
  restoreDatabaseDump
};
