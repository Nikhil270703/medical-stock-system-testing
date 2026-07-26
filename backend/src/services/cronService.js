const cron = require('node-cron');
const Order = require('../models/order');
const Notification = require('../models/notification');

// Scans for deliveries scheduled for tomorrow and generates in-app notifications
const runReminderJob = async () => {
  console.log('[cron-service] Running daily upcoming delivery reminders scan...');
  try {
    const today = new Date();
    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(today);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const upcomingOrders = await Order.find({
      deliveryDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
      status: { $in: ['Pending', 'Assigned', 'Packed'] }
    }).populate('customer').populate('assignedStaff');

    console.log(`[cron-service] Found ${upcomingOrders.length} orders scheduled for tomorrow.`);

    let notificationsCreated = 0;
    for (const order of upcomingOrders) {
      // Check if a reminder notification already exists for this order
      const existing = await Notification.findOne({
        type: 'delivery_reminder',
        relatedId: order._id
      });

      if (!existing) {
        const staffName = order.assignedStaff ? order.assignedStaff.name : 'Unassigned';
        const msg = `Order for customer "${order.customer.name}" is scheduled for delivery tomorrow. Assigned Delivery Executive: ${staffName}.`;
        
        await Notification.create({
          title: 'Upcoming Delivery Reminder',
          message: msg,
          type: 'delivery_reminder',
          relatedId: order._id
        });
        notificationsCreated++;
      }
    }

    console.log(`[cron-service] Created ${notificationsCreated} upcoming delivery notification reminders.`);
  } catch (err) {
    console.error('[cron-service] Error running reminder job:', err.message);
  }
};

const runRecurringOrdersJob = async () => {
  console.log('[cron-service] Scanning for recurring orders to auto-create...');
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(23, 59, 59, 999);

    const expiredRecurringOrders = await Order.find({
      isRecurring: true,
      status: 'Delivered',
      recurringProcessed: false,
      deliveryDate: { $lte: thirtyDaysAgo }
    }).populate('customer');

    console.log(`[cron-service] Found ${expiredRecurringOrders.length} recurring orders ready for regeneration.`);

    let count = 0;
    for (const oldOrder of expiredRecurringOrders) {
      const newOrderDate = new Date();
      
      const newOrder = new Order({
        customer: oldOrder.customer._id,
        items: oldOrder.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          price: item.price,
          vendor: item.vendor
        })),
        totalAmount: oldOrder.totalAmount,
        deliveryDate: newOrderDate,
        status: 'Pending',
        branch: oldOrder.branch,
        isRecurring: true,
        recurringIntervalDays: oldOrder.recurringIntervalDays || 30,
        recurringSourceOrder: oldOrder._id,
        recurringProcessed: false
      });

      await newOrder.save();

      oldOrder.recurringProcessed = true;
      await oldOrder.save();

      await Notification.create({
        title: 'Recurring Order Auto-Created',
        message: `A new recurring order was auto-created for customer "${oldOrder.customer.name}" based on delivered Order ORD-${oldOrder._id.toString().substring(18).toUpperCase()}.`,
        type: 'recurring_order',
        relatedId: newOrder._id
      });

      count++;
    }

    if (count > 0) {
      console.log(`[cron-service] Successfully auto-created ${count} recurring orders.`);
    }
  } catch (err) {
    console.error('[cron-service] Error running recurring orders job:', err.message);
  }
};

const runWeeklySqliteBackupJob = async () => {
  console.log('[cron-service] Running weekly MongoDB to SQLite database backup...');
  try {
    const { runBackup } = require('../../scripts/backupToSqlite');
    await runBackup();
    console.log('[cron-service] Weekly SQLite backup completed successfully.');
  } catch (err) {
    console.error('[cron-service] Weekly SQLite backup failed:', err.message);
  }
};

const initCron = () => {
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    runReminderJob();
    runRecurringOrdersJob();
  });

  // Run weekly SQLite backup every Sunday at 03:00 AM
  cron.schedule('0 3 * * 0', () => {
    runWeeklySqliteBackupJob();
  });

  console.log('[cron-service] node-cron scheduler initialized successfully (daily reminders & weekly SQLite backup).');
  
  // Proactively run once on startup
  setTimeout(() => {
    runReminderJob();
    runRecurringOrdersJob();
  }, 5000);
};

module.exports = { initCron, runReminderJob, runRecurringOrdersJob, runWeeklySqliteBackupJob };

