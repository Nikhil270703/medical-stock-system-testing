const Category = require('../models/category');
const Unit = require('../models/unit');
const HsnCode = require('../models/hsnCode');

function normalizeKey(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function seedMasterData() {
  const env = process.env.NODE_ENV || 'development';
  // Allow seeding in development and testing environments (or default standalone)
  if (env === 'production' && process.env.ENABLE_PROD_SEED !== 'true') {
    console.log('[master-seeder] Production environment detected. Skipping auto-seeder.');
    return;
  }

  console.log('[master-seeder] Checking master collections for initial and testing dummy data...');

  try {
    // 1. Categories
    const sampleCategories = [
      'Tablet', 'Capsule', 'Injection', 'Syrup', 'Cream',
      'Drops', 'Ointment', 'Powder', 'Gel', 'Spray', 'Solution', 'Lotion'
    ];

    let catCount = 0;
    for (const name of sampleCategories) {
      const nameLower = normalizeKey(name);
      const existing = await Category.findOne({ nameLower });
      if (!existing) {
        await Category.create({ name: name.trim(), nameLower, status: 'Active' });
        catCount++;
      }
    }
    if (catCount > 0) {
      console.log(`[master-seeder] Seeded ${catCount} new Category records.`);
    }

    // 2. Units
    const sampleUnits = [
      'Strip', 'Bottle', 'Piece', 'Pack', 'Box',
      'Tube', 'Jar', 'Ampoule', 'Vial', 'Carton', 'Pouch'
    ];

    let unitCount = 0;
    for (const name of sampleUnits) {
      const nameLower = normalizeKey(name);
      const existing = await Unit.findOne({ nameLower });
      if (!existing) {
        await Unit.create({ name: name.trim(), nameLower, status: 'Active' });
        unitCount++;
      }
    }
    if (unitCount > 0) {
      console.log(`[master-seeder] Seeded ${unitCount} new Unit records.`);
    }

    // 3. HSN Codes
    const sampleHsnCodes = [
      '3003', '3004', '9018',
      '3005', '3006', '3822', '9021', '9402'
    ];

    let hsnCount = 0;
    for (const code of sampleHsnCodes) {
      const codeLower = normalizeKey(code);
      const existing = await HsnCode.findOne({ codeLower });
      if (!existing) {
        await HsnCode.create({ code: code.trim(), codeLower, status: 'Active' });
        hsnCount++;
      }
    }
    if (hsnCount > 0) {
      console.log(`[master-seeder] Seeded ${hsnCount} new HSN Code records.`);
    }

    // 4. Vendor GST Enrichment
    const Vendor = require('../models/vendor');
    const vendorsWithoutGst = await Vendor.find({ $or: [{ gstNumber: { $exists: false } }, { gstNumber: '' }] });
    const sampleGstins = ['27AAAAA0000A1Z5', '27BBBBB1111B2Z6', '27CCCCC2222C3Z7', '27DDDDD3333D4Z8'];
    let vGstCount = 0;
    for (let idx = 0; idx < vendorsWithoutGst.length; idx++) {
      const v = vendorsWithoutGst[idx];
      v.gstNumber = sampleGstins[idx % sampleGstins.length];
      v.gstType = 'Regular';
      await v.save();
      vGstCount++;
    }
    if (vGstCount > 0) {
      console.log(`[master-seeder] Enriched ${vGstCount} Vendor records with sample GSTINs.`);
    }

    // 5. Product Multi-Category Enrichment
    const Product = require('../models/product');
    const productsWithoutCatArray = await Product.find({ $or: [{ categories: { $exists: false } }, { categories: { $size: 0 } }] });
    let pCatCount = 0;
    for (const p of productsWithoutCatArray) {
      if (p.category) {
        const catArray = p.category.split(',').map(s => s.trim()).filter(Boolean);
        p.categories = catArray;
        await p.save();
        pCatCount++;
      }
    }
    if (pCatCount > 0) {
      console.log(`[master-seeder] Enriched ${pCatCount} Product records with multi-category arrays.`);
    }

    // 6. Seed Purchase Orders with Partial Receipts
    const PurchaseOrder = require('../models/purchaseOrder');
    const Branch = require('../models/branch');
    const poCount = await PurchaseOrder.countDocuments({});

    if (poCount === 0) {
      const sampleVendors = await Vendor.find({});
      const sampleProds = await Product.find({});
      const sampleBranch = await Branch.findOne({}) || { _id: null };

      if (sampleVendors.length > 0 && sampleProds.length >= 2) {
        // PO 1: Partially Received
        const po1 = new PurchaseOrder({
          supplier: sampleVendors[0]._id,
          branch: sampleBranch._id,
          status: 'Partially Received',
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 3),
          totalCost: sampleProds[0].price * 100 + sampleProds[1].price * 50,
          items: [
            { product: sampleProds[0]._id, quantity: 100, costPrice: sampleProds[0].price * 0.7, receivedQuantity: 60 },
            { product: sampleProds[1]._id, quantity: 50, costPrice: sampleProds[1].price * 0.7, receivedQuantity: 0 }
          ],
          receivingHistory: [{
            receivedBy: 'Main Warehouse Manager',
            date: new Date(Date.now() - 86400000),
            items: [
              { product: sampleProds[0]._id, quantity: 60, location: 'Shelf A-12', remarks: 'First partial batch' }
            ]
          }]
        });
        await po1.save();

        // PO 2: Pending
        const po2 = new PurchaseOrder({
          supplier: sampleVendors[sampleVendors.length - 1]._id,
          branch: sampleBranch._id,
          status: 'Pending',
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 7),
          totalCost: sampleProds[0].price * 200,
          items: [
            { product: sampleProds[0]._id, quantity: 200, costPrice: sampleProds[0].price * 0.7, receivedQuantity: 0 }
          ]
        });
        await po2.save();

        console.log('[master-seeder] Seeded 2 realistic Purchase Orders with partial receiving history.');
      }
    }

    // 7. Seed Sales Orders with Custom Recurrence & Delivery Assignments
    const Order = require('../models/order');
    const Customer = require('../models/customer');
    const Employee = require('../models/employee');

    const orderCount = await Order.countDocuments({});
    if (orderCount === 0) {
      const sampleCusts = await Customer.find({});
      const sampleProds = await Product.find({});
      const sampleEmps = await Employee.find({ role: /delivery/i });
      const mainEmp = sampleEmps.length > 0 ? sampleEmps[0] : null;

      if (sampleCusts.length >= 2 && sampleProds.length >= 2) {
        // Sales Order 1: Packed (Stock Reserved) with 15 Days Recurrence
        const o1 = new Order({
          customer: sampleCusts[0]._id,
          deliveryDate: new Date(Date.now() + 86400000 * 2),
          status: 'Packed',
          totalAmount: sampleProds[0].price * 5 + sampleProds[1].price * 2,
          isRecurring: true,
          recurringIntervalDays: 15,
          remarks: 'Urgent clinic stock refill',
          items: [
            { product: sampleProds[0]._id, quantity: 5, price: sampleProds[0].price, vendor: sampleProds[0].linkedVendor },
            { product: sampleProds[1]._id, quantity: 2, price: sampleProds[1].price, vendor: sampleProds[1].linkedVendor }
          ],
          assignedTo: mainEmp ? mainEmp._id : null,
          assignmentHistory: mainEmp ? [{
            assignedTo: mainEmp._id,
            assignedBy: 'Operations Lead',
            date: new Date()
          }] : []
        });
        await o1.save();

        // Update reservedStock for products in Packed status
        sampleProds[0].reservedStock = (sampleProds[0].reservedStock || 0) + 5;
        await sampleProds[0].save();
        sampleProds[1].reservedStock = (sampleProds[1].reservedStock || 0) + 2;
        await sampleProds[1].save();

        // Sales Order 2: Out for Delivery with 7 Days (Every Week) Recurrence
        const o2 = new Order({
          customer: sampleCusts[1]._id,
          deliveryDate: new Date(),
          status: 'Out for Delivery',
          totalAmount: sampleProds[0].price * 10,
          isRecurring: true,
          recurringIntervalDays: 7,
          remarks: 'Weekly scheduled supply',
          items: [
            { product: sampleProds[0]._id, quantity: 10, price: sampleProds[0].price, vendor: sampleProds[0].linkedVendor }
          ],
          assignedTo: mainEmp ? mainEmp._id : null,
          assignmentHistory: mainEmp ? [{
            assignedTo: mainEmp._id,
            assignedBy: 'Operations Lead',
            date: new Date()
          }] : []
        });
        await o2.save();

        sampleProds[0].reservedStock = (sampleProds[0].reservedStock || 0) + 10;
        await sampleProds[0].save();

        console.log('[master-seeder] Seeded 2 realistic Sales Orders with custom recurrences and delivery assignments.');
      }
    }

    console.log('[master-seeder] Master data seeding check complete! ✅');
  } catch (err) {
    console.error('[master-seeder] Error during master seeding:', err.message);
  }
}

module.exports = { seedMasterData };
