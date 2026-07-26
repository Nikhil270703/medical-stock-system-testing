const Branch = require('../models/branch');
const Employee = require('../models/employee');
const User = require('../models/user');
const PurchaseOrder = require('../models/purchaseOrder');
const AuditLog = require('../models/auditLog');
const whatsappClient = require('../services/whatsappClient');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const StockAdjustment = require('../models/stockAdjustment');
const Expense = require('../models/expense');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Setting = require('../models/setting');
const auditService = require('../services/auditService');
const backupService = require('../services/backupService');

// ==================== BRANCH MANAGEMENT ====================

exports.createBranch = async (req, res) => {
  try {
    const { name, address, contact } = req.body;
    if (!name || !address || !contact) {
      return res.status(400).json({ error: 'Name, address and contact details are required' });
    }

    const normalizedInput = String(name).trim().replace(/\s+/g, ' ');
    if (!normalizedInput) {
      return res.status(400).json({ error: 'Branch name cannot be empty' });
    }

    const tokens = normalizedInput.split(' ').map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = `^\\s*${tokens.join('\\s+')}\\s*$`;

    const existingBranch = await Branch.findOne({
      name: { $regex: new RegExp(pattern, 'i') }
    }).select('_id');

    if (existingBranch) {
      return res.status(409).json({
        success: false,
        message: "Branch already exists."
      });
    }

    const branch = new Branch({ name, address, contact });
    await branch.save();
    
    // Log audit trail
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Branch',
      branch._id,
      { name }
    );

    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({}).sort({ name: 1 });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== EMPLOYEE MODULE ====================

exports.createEmployee = async (req, res) => {
  try {
    const { name, mobile, role, joiningDate, branchId, email, password } = req.body;
    if (!name || !mobile || !role || !branchId) {
      return res.status(400).json({ error: 'Name, mobile, role, and branchId are required' });
    }

    let linkedUser = null;
    if (email && password) {
      // Check if user exists
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ error: 'Email already mapped to an active login account' });

      // Map role to login role
      let userRole = 'staff';
      if (role === 'Admin') userRole = 'admin';
      if (role === 'Manager') userRole = 'staff'; // manager role check handled inside permissions middleware

      const user = new User({
        name,
        email,
        password,
        mobile,
        role: userRole,
        status: 'Active'
      });
      await user.save();
      linkedUser = user._id;
    }

    const employee = new Employee({
      name,
      mobile,
      role,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      user: linkedUser,
      branch: branchId,
      status: 'Active'
    });
    await employee.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Employee',
      employee._id,
      { name, role }
    );

    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const employees = await Employee.find(filter)
      .populate('branch', 'name')
      .populate('user', 'email role')
      .sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const updated = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('branch', 'name');

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'Employee',
      updated._id,
      { name: updated.name, status: updated.status }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    if (employee.user) {
      await User.findByIdAndDelete(employee.user);
    }
    await Employee.findByIdAndDelete(req.params.id);

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'delete',
      'Employee',
      employee._id,
      { name: employee.name }
    );

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployeePerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.deliveryDate = {};
      if (startDate) dateFilter.deliveryDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateFilter.deliveryDate.$lte = eDate;
      }
    }

    const employees = await Employee.find({ role: 'Delivery Staff' });
    const performanceReport = [];

    for (const emp of employees) {
      // Find orders linked to this employee's login user account
      if (!emp.user) continue;

      const orders = await Order.find({
        assignedStaff: emp.user,
        status: 'Delivered',
        ...dateFilter
      });

      let totalDeliveryTime = 0;
      let onTimeCount = 0;
      let delayedCount = 0;

      orders.forEach(order => {
        if (order.deliveredAt && order.createdAt) {
          const diffInMinutes = Math.floor((new Date(order.deliveredAt) - new Date(order.createdAt)) / 60000);
          totalDeliveryTime += diffInMinutes;

          // Delivery is on-time if completed within 24 hours of deliveryDate schedule
          const schedLimit = new Date(order.deliveryDate);
          schedLimit.setHours(23, 59, 59, 999);
          if (new Date(order.deliveredAt) <= schedLimit) {
            onTimeCount++;
          } else {
            delayedCount++;
          }
        }
      });

      const avgTime = orders.length > 0 ? Math.floor(totalDeliveryTime / orders.length) : 0;

      performanceReport.push({
        employeeId: emp._id,
        name: emp.name,
        mobile: emp.mobile,
        branchName: emp.branch ? (await Branch.findById(emp.branch))?.name : 'N/A',
        deliveriesCompleted: orders.length,
        averageDeliveryTimeInMinutes: avgTime,
        onTimeDeliveries: onTimeCount,
        delayedDeliveries: delayedCount
      });
    }

    res.json(performanceReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== QUOTATION TO BILL/INVOICE ====================

exports.convertQuotationToInvoice = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('customer');
    if (!quotation) return res.status(404).json({ error: 'Quotation proposal not found' });
    
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'Quotation already converted to an invoice' });
    }

    // Generate Invoice sequence
    const invoiceCount = await Bill.countDocuments({});
    const invoiceNumber = `INV-${Date.now().toString().substring(7)}-${invoiceCount + 1}`;

    // GST calculations based on customer state vs shop setting
    const settings = await Setting.findOne({}) || new Setting();
    const isInterState = quotation.customer.state && settings.state && 
                        quotation.customer.state.toLowerCase().trim() !== settings.state.toLowerCase().trim();

    const subtotal = quotation.totalAmount;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    if (isInterState) {
      igstTotal = subtotal * 0.18; // 18% standard IGST
    } else {
      cgstTotal = subtotal * 0.09; // 9% CGST
      sgstTotal = subtotal * 0.09; // 9% SGST
    }

    const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;

    const billItems = [];
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      billItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        cgst: isInterState ? 0 : 9,
        sgst: isInterState ? 0 : 9,
        igst: isInterState ? 18 : 0
      });
    }

    const bill = new Bill({
      invoiceNumber,
      customer: quotation.customer._id,
      items: billItems,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalAmount: grandTotal,
      status: 'Unpaid',
      quotationRef: quotation._id,
      branch: quotation.customer.branch || null
    });
    await bill.save();

    // Mark quotation status
    quotation.status = 'Converted';
    await quotation.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Bill',
      bill._id,
      { invoiceNumber, fromQuotation: quotation._id }
    );

    res.status(201).json({ message: 'Quotation converted successfully to Tax Invoice Bill!', bill });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PROCUREMENT & PURCHASE ORDERS ====================

exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, items, expectedDeliveryDate, branchId } = req.body;
    if (!supplierId || !items || !items.length || !expectedDeliveryDate || !branchId) {
      return res.status(400).json({ error: 'Supplier, items list, delivery date, and branchId are required' });
    }

    let totalCost = 0;
    const poItems = [];
    for (const it of items) {
      const p = await Product.findById(it.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${it.product}` });
      totalCost += Number(it.costPrice) * Number(it.quantity);
      poItems.push({
        product: it.product,
        quantity: Number(it.quantity),
        costPrice: Number(it.costPrice)
      });
    }

    const po = new PurchaseOrder({
      supplier: supplierId,
      items: poItems,
      totalCost,
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      branch: branchId,
      status: 'Ordered'
    });

    await po.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'PurchaseOrder',
      po._id,
      { totalCost }
    );

    // ==================== SEND WHATSAPP TO VENDOR ====================
    try {
      const vendor = await Vendor.findById(supplierId);
      const settings = await Setting.findOne({});
      
      if (vendor && vendor.contact && settings && settings.whatsappToken && settings.whatsappPhoneId) {
        let mobile = vendor.contact.replace(/\D/g, '');
        if (mobile.length === 10) mobile = `91${mobile}`;

        const msg = `Hello ${vendor.name},\n\nA new Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) has been dispatched to you from our company.\n\nTotal Items: ${poItems.length}\nExpected Delivery Date: ${new Date(expectedDeliveryDate).toLocaleDateString()}\n\nPlease check your email/portal for the full PO document.\n\nThank you!`;

        const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.whatsappToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: mobile,
            type: 'text',
            text: { body: msg }
          })
        }).catch(err => console.error('Failed to send WhatsApp to vendor:', err)); // Fire and forget
      }
    } catch (waErr) {
      console.error('WhatsApp notification error:', waErr);
    }
    // =================================================================

    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const pos = await PurchaseOrder.find(filter)
      .populate('supplier')
      .populate('branch', 'name')
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendPurchaseOrderWhatsapp = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('supplier');
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    const vendor = po.supplier;
    if (!vendor || !vendor.contact) {
      return res.status(400).json({ error: 'This vendor does not have a contact number saved.' });
    }

    const settings = await Setting.findOne({});
    let mobile = vendor.contact.replace(/\D/g, '');
    if (mobile.length === 10) mobile = `91${mobile}`;

    const msg = `Hello ${vendor.name},\n\nA friendly reminder about Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) dispatched to you.\n\nTotal Items: ${po.items.length}\nExpected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}\nStatus: ${po.status}\n\nPlease update us on the delivery schedule. Thank you!`;

    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(mobile, msg);
        return res.json({ message: 'WhatsApp notification sent successfully via Local Client!', po });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API credentials are not configured. Please go to the WhatsApp page -> API Configuration tab to set them up.' });
    }

    const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: mobile,
        type: 'text',
        text: { body: msg }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Failed to send WhatsApp message' });
    }

    res.json({ message: 'WhatsApp notification sent successfully!', po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.receivePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    if (po.status === 'Received') {
      return res.status(400).json({ error: 'Purchase Order already received' });
    }

    // Increment stocks
    for (const item of po.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const oldStock = product.currentStock;
        product.currentStock += item.quantity;
        await product.save();

        // Log Stock History
        await StockHistory.create({
          product: product._id,
          quantity: item.quantity,
          type: 'in',
          reason: 'purchase'
        });
      }
    }

    po.status = 'Received';
    await po.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'PurchaseOrder',
      po._id,
      { status: 'Received' }
    );

    res.json({ message: 'Purchase products received, stock levels updated! 📦', po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== MANUAL STOCK ADJUSTMENTS ====================

exports.manualAdjustProductStock = async (req, res) => {
  try {
    const { newQty, reason } = req.body;
    if (newQty === undefined || !reason) {
      return res.status(400).json({ error: 'New quantity level and reason are required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product catalog entry not found' });

    const oldQty = product.currentStock;
    product.currentStock = Number(newQty);
    await product.save();

    let userId = req.ctx ? req.ctx.userId : req.user ? req.user.id : null;
    if (!userId) {
      const User = require('../models/user');
      const fallbackUser = await User.findOne({ role: 'admin' });
      if (fallbackUser) userId = fallbackUser._id;
    }

    // Log Stock Adjustment audit trail
    const adjustment = new StockAdjustment({
      product: product._id,
      oldQty,
      newQty: Number(newQty),
      adjustedBy: userId,
      reason
    });
    await adjustment.save();

    // Log Stock History
    const qtyDiff = Math.abs(Number(newQty) - oldQty);
    const adjustType = Number(newQty) >= oldQty ? 'in' : 'out';

    await StockHistory.create({
      product: product._id,
      quantity: qtyDiff,
      type: adjustType,
      reason: 'adjustment'
    });

    await auditService.logAction(
      userId,
      'update',
      'ProductStock',
      product._id,
      { oldQty, newQty: Number(newQty), reason }
    );

    res.json({ product, adjustment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReorderList = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const products = await Product.find(filter).populate('linkedVendor', 'name');
    const reorderList = products.filter(p => p.currentStock <= p.lowStockThreshold);
    res.json(reorderList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProductStockLog = async (req, res) => {
  try {
    const logs = await StockHistory.find({ product: req.params.id })
      .sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== EXPENSE MODULE ====================

exports.createExpense = async (req, res) => {
  try {
    const { category, amount, date, notes, receiptImage, branchId } = req.body;
    if (!category || !amount || !branchId) {
      return res.status(400).json({ error: 'Category, amount, and branchId are required' });
    }
    
    const expense = new Expense({
      category,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      notes,
      receiptImage,
      branch: branchId
    });
    await expense.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Expense',
      expense._id,
      { category, amount }
    );

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const expenses = await Expense.find(filter)
      .populate('branch', 'name')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'delete',
      'Expense',
      expense._id,
      { category: expense.category, amount: expense.amount }
    );

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== BACKUP, RESTORE & AUDIT LOGS ====================

exports.exportBackupJSON = async (req, res) => {
  try {
    const data = await backupService.generateDatabaseDump();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=shop_backup.json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.importBackupJSON = async (req, res) => {
  try {
    const dump = req.body;
    if (!dump || typeof dump !== 'object') {
      return res.status(400).json({ error: 'Valid JSON backup object is required' });
    }
    await backupService.restoreDatabaseDump(dump);
    
    // Log audit trail
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'SystemDatabase',
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'Full database restore operation executed'
    );

    res.json({ message: 'Database restore operation completed successfully! ✅' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { user, entity, startDate, endDate } = req.query;
    const filter = {};
    if (user) filter.user = user;
    if (entity) filter.entity = entity;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = eDate;
      }
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk Import
exports.bulkImportExcel = async (req, res) => {
  try {
    const { type, list } = req.body; // type: 'customers' | 'products', list: array of objects
    if (!type || !list || !Array.isArray(list)) {
      return res.status(400).json({ error: 'Type (customers/products) and lists array are required' });
    }

    let insertedCount = 0;
    const errors = [];

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      try {
        if (type === 'customers') {
          if (!row.name || !row.mobile || !row.address) {
            throw new Error('Name, mobile, and address are mandatory fields');
          }
          const exists = await Customer.findOne({ mobile: row.mobile });
          if (exists) {
            throw new Error(`Customer with mobile ${row.mobile} already exists`);
          }
          const customer = new Customer({
            name: row.name,
            mobile: row.mobile.toString(),
            address: row.address,
            gstNumber: row.gstNumber || '',
            state: row.state || 'Maharashtra'
          });
          await customer.save();
          insertedCount++;
        } else if (type === 'products') {
          if (!row.name || !row.category || !row.unit || !row.price || !row.linkedVendor) {
            throw new Error('Name, category, unit, price, and linkedVendor name are mandatory fields');
          }
          
          // Try to resolve vendor ID
          const vendor = await Vendor.findOne({ name: { $regex: new RegExp(row.linkedVendor, 'i') } });
          if (!vendor) {
            throw new Error(`Supplier vendor "${row.linkedVendor}" not found in database`);
          }

          const product = new Product({
            name: row.name,
            category: row.category,
            unit: row.unit,
            price: Number(row.price),
            currentStock: Number(row.currentStock) || 0,
            lowStockThreshold: Number(row.lowStockThreshold) || 10,
            linkedVendor: vendor._id,
            hsnCode: row.hsnCode || 'HSN3004'
          });
          await product.save();
          insertedCount++;
        }
      } catch (err) {
        errors.push({ rowIndex: i + 1, error: err.message });
      }
    }

    // Audit Log bulk import
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      `BulkImport_${type}`,
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      `Imported ${insertedCount} items, with ${errors.length} errors`
    );

    res.json({ total: list.length, imported: insertedCount, failures: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.triggerRecurringScan = async (req, res) => {
  try {
    const cronService = require('../services/cronService');
    await cronService.runRecurringOrdersJob();
    res.json({ message: 'Recurring orders auto-creation scan executed successfully! 🔁' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendQuotationWhatsapp = async (req, res) => {
  try {
    const Quotation = require('../models/quotation'); // Make sure we have it imported
    const quotation = await Quotation.findById(req.params.id).populate('customer').populate('items.product');
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const customer = quotation.customer;
    if (!customer || !customer.mobile) {
      return res.status(400).json({ error: 'This customer does not have a mobile number saved.' });
    }

    const settings = await Setting.findOne({});

    let mobile = customer.mobile.replace(/\D/g, '');
    if (!mobile.startsWith('91') && mobile.length === 10) {
      mobile = '91' + mobile; // Default to India prefix if exactly 10 digits
    }

    const validDate = new Date(quotation.validUntil).toLocaleDateString();
    
    const totalAmount = quotation.totalAmount;
    // Replace literal \\n with standard \n for local client readability
    let itemsText = quotation.items.map(i => `- ${i.quantity}x ${i.product?.name || 'Item'} (Rs. ${i.price.toFixed(2)})`).join('\n');
    let messageText = `*Quotation/Cost Estimate*\n\nHello ${customer.name},\n\nHere is your requested quotation for the following items:\n\n${itemsText}\n\n*Total Amount:* Rs. ${totalAmount.toFixed(2)}\n*Valid Until:* ${validDate}\n\nThank you for choosing us!\n`;

    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(mobile, messageText);
        return res.json({ message: 'Quotation sent successfully via Local WhatsApp! ✅', data: quotation });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API credentials are not configured. Please go to the WhatsApp page -> API Configuration tab to set them up.' });
    }
    
    // For Meta API, we use \\n because it gets JSON stringified in a certain way in some apps, though \n works perfectly fine in JSON.stringify too.
    let metaMessageText = `*Quotation/Cost Estimate*\\n\\nHello ${customer.name},\\n\\nHere is your requested quotation for the following items:\\n\\n${itemsText.replace(/\n/g, '\\n')}\\n\\n*Total Amount:* Rs. ${totalAmount.toFixed(2)}\\n*Valid Until:* ${validDate}\\n\\nThank you for choosing us!\\n`;

    const response = await fetch(`https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: mobile,
        type: 'text',
        text: { body: metaMessageText }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    res.json({ message: 'Quotation sent successfully via WhatsApp! ✅', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
