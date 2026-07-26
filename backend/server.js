require('dotenv').config();
const app = require('./src/app');
const { connectDb } = require('./src/config/db');
const env = require('./src/config/env');
const { initCron } = require('./src/services/cronService');
const { seedMasterData } = require('./src/seeds/masterSeeder');
//require('./src/services/whatsappClient'); // Initialize local WhatsApp client

const autoSeed = async () => {
  try {
    const User = require('./src/models/user');
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('[seed] Database is empty. Auto-seeding initial shop admin and staff users...');

      // Admin
      const admin = new User({
        email: 'admin@school.com',
        password: 'admin123',
        role: 'admin',
        name: 'System Admin (Shop)',
        mobile: '9876543210',
        status: 'Active'
      });
      await admin.save();
      console.log('[seed] Shop Admin user created: admin@school.com / admin123');

      // Staff
      const staff = new User({
        email: 'staff@shop.com',
        password: 'staff123',
        role: 'staff',
        name: 'Ramesh Powar (Staff)',
        mobile: '9123456789',
        status: 'Active'
      });
      await staff.save();
      console.log('[seed] Shop Staff user created: staff@shop.com / staff123');

      // Default Setting
      const Setting = require('./src/models/setting');
      const setting = new Setting({
        companyName: 'Tammewar Pharmacy',
        address: 'Pune, Maharashtra',
        email: 'admin@school.com',
        contact: '9876543210'
      });
      await setting.save();
      console.log('[seed] Default settings created.');
      console.log('[seed] Auto-seeding complete! ✅');
    }
  } catch (err) {
    console.error('[seed] Auto-seed failed (will skip):', err.message);
  }
};

(async () => {
  try {
    await connectDb();
    await autoSeed();
    await seedMasterData();
    initCron();

    const PORT = process.env.PORT || env.PORT || 4009;

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[shop-management] backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  }
})();
