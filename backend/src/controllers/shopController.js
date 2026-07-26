const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const Order = require('../models/order');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Payment = require('../models/payment');
const Notification = require('../models/notification');
const Setting = require('../models/setting');
const User = require('../models/user');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');
const whatsappClient = require('../services/whatsappClient');

// ==================== DASHBOARD & NOTIFICATIONS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    
    // Low stock count
    const products = await Product.find({});
    const lowStockAlerts = products.filter(p => p.currentStock <= p.lowStockThreshold);

    // Sales totals
    const bills = await Bill.find({});
    const totalSales = bills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Filter today's vs monthly sales
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfThisMonth = new Date();
    startOfThisMonth.setDate(1);
    startOfThisMonth.setHours(0, 0, 0, 0);

    const todaySales = bills
      .filter(b => new Date(b.createdAt) >= startOfToday)
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const monthSales = bills
      .filter(b => new Date(b.createdAt) >= startOfThisMonth)
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // Payments and Outstanding dues
    const payments = await Payment.find({});
    const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalOutstanding = Math.max(0, totalSales - totalPaymentsReceived);

    // Deliveries counts
    const todayEnd = new Date(startOfToday);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const todayDeliveries = await Order.countDocuments({
      deliveryDate: { $gte: startOfToday, $lte: todayEnd },
      status: { $ne: 'Cancelled' }
    });

    const tomorrowDeliveries = await Order.countDocuments({
      deliveryDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
      status: { $ne: 'Cancelled' }
    });

    const pendingDeliveries = await Order.countDocuments({
      status: { $in: ['Pending', 'Assigned', 'Packed', 'Out for Delivery'] }
    });

    // Recent transactions
    const recentPayments = await Payment.find({})
      .populate('customer')
      .sort({ date: -1 })
      .limit(5);

    // Customer dues list
    const customerList = await Customer.find({});
    const customerDues = [];
    for (const customer of customerList) {
      const custBills = await Bill.find({ customer: customer._id });
      const custPayments = await Payment.find({ customer: customer._id });
      const bSum = custBills.reduce((s, b) => s + b.totalAmount, 0);
      const pSum = custPayments.reduce((s, p) => s + p.amountPaid, 0);
      const outstanding = Math.max(0, bSum - pSum);
      if (outstanding > 0) {
        customerDues.push({
          customerId: customer._id,
          name: customer.name,
          mobile: customer.mobile,
          outstanding
        });
      }
    }
    customerDues.sort((a, b) => b.outstanding - a.outstanding);

    // Recurring order loops info
    const recurringOrders = await Order.find({ isRecurring: true })
      .populate('customer', 'name mobile')
      .sort({ createdAt: -1 });

    const activeLoopsMap = {};
    for (const ord of recurringOrders) {
      if (ord.customer && !activeLoopsMap[ord.customer._id.toString()]) {
        const lastDate = new Date(ord.deliveryDate);
        const nextRun = new Date(lastDate);
        nextRun.setDate(nextRun.getDate() + (ord.recurringIntervalDays || 30));

        activeLoopsMap[ord.customer._id.toString()] = {
          orderId: ord._id,
          customerName: ord.customer.name,
          customerMobile: ord.customer.mobile,
          itemsCount: ord.items.length,
          totalAmount: ord.totalAmount,
          lastRun: ord.deliveryDate,
          nextRun: nextRun,
          status: ord.status,
          recurringProcessed: ord.recurringProcessed
        };
      }
    }
    const activeLoops = Object.values(activeLoopsMap);

    // Orders Analysis
    const orderStatusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const orderStatusCounts = {
      Pending: 0, Assigned: 0, Packed: 0, 'Out for Delivery': 0, Delivered: 0, Cancelled: 0
    };
    orderStatusAgg.forEach(s => {
      if (orderStatusCounts[s._id] !== undefined) {
        orderStatusCounts[s._id] = s.count;
      }
    });

    const recentOrders = await Order.find({})
      .populate('customer', 'name mobile')
      .sort({ createdAt: -1 })
      .limit(8);

    res.json({
      totalCustomers,
      totalProducts,
      lowStockCount: lowStockAlerts.length,
      lowStockAlerts: lowStockAlerts.map(p => ({ _id: p._id, name: p.name, currentStock: p.currentStock, threshold: p.lowStockThreshold })),
      todayDeliveries,
      tomorrowDeliveries,
      pendingDeliveries,
      totalOutstanding,
      totalSales,
      todaySales,
      thisMonthSales: monthSales,
      recentTransactions: recentPayments.map(p => ({
        _id: p._id,
        customerName: p.customer.name,
        amount: p.amountPaid,
        mode: p.paymentMode,
        date: p.date,
        ref: p.referenceNumber
      })),
      customerDues,
      activeLoops,
      orderStatusCounts,
      recentOrders: recentOrders.map(o => ({
        _id: o._id,
        ref: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
        customerName: o.customer?.name || 'Unknown',
        totalAmount: o.totalAmount,
        status: o.status,
        date: o.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(30);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== CUSTOMERS ====================

exports.createCustomer = async (req, res) => {
  try {
    const { name, mobile, address, gstNumber, notes, defaultRecurringDays, creditLimit, password } = req.body;
    if (!name || !mobile || !address) {
      return res.status(400).json({ error: 'Name, mobile and address are required' });
    }
    const existing = await Customer.findOne({ mobile });
    if (existing) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists' });
    }
    const customer = new Customer({ 
      name, 
      mobile, 
      address, 
      gstNumber, 
      notes, 
      defaultRecurringDays: defaultRecurringDays || 0,
      creditLimit: creditLimit || 0
    });
    
    if (password && password.trim() !== '') {
      customer.password = password;
    }
    
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await Order.find({ customer: customer._id })
      .populate('assignedStaff', 'name mobile')
      .sort({ createdAt: -1 });

    const bills = await Bill.find({ customer: customer._id }).sort({ createdAt: -1 });
    const payments = await Payment.find({ customer: customer._id }).sort({ date: -1 });

    // Calculate outstanding
    const bSum = bills.reduce((s, b) => s + b.totalAmount, 0);
    const pSum = payments.reduce((s, p) => s + p.amountPaid, 0);
    const outstanding = Math.max(0, bSum - pSum);

    // Combine history for a timeline
    const history = [];
    orders.forEach(o => {
      history.push({
        type: 'Order',
        id: o._id,
        ref: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
        date: o.createdAt,
        status: o.status,
        amount: o.totalAmount
      });
    });
    bills.forEach(b => {
      history.push({
        type: 'Invoice',
        id: b._id,
        ref: b.invoiceNumber,
        date: b.createdAt,
        status: b.status,
        amount: b.totalAmount
      });
    });
    payments.forEach(p => {
      history.push({
        type: 'Payment Received',
        id: p._id,
        ref: p.referenceNumber || 'Cash/UPI',
        date: p.date,
        status: 'Cleared',
        amount: p.amountPaid
      });
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      customer,
      outstanding,
      orderHistory: orders,
      billHistory: bills,
      paymentHistory: payments,
      timeline: history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const { password, ...updateData } = req.body;
    
    // Assign fields
    Object.assign(customer, updateData);
    
    // Process password separately if provided
    if (password && password.trim() !== '') {
      customer.password = password;
    }

    const updated = await customer.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== VENDORS ====================

exports.createVendor = async (req, res) => {
  try {
    const { name, contact, address, itemCategories, gstNumber, gstType } = req.body;
    if (!name || !contact || !address) {
      return res.status(400).json({ error: 'Name, contact, and address are required' });
    }
    const vendor = new Vendor({ name, contact, address, itemCategories, gstNumber, gstType });
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({}).sort({ name: 1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const updated = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PRODUCTS & STOCK ====================

exports.createProduct = async (req, res) => {
  try {
    const { name, category, categories, unit, price, currentStock, lowStockThreshold, linkedVendor, hsnCode } = req.body;
    
    // Normalize categories array
    let catArray = [];
    if (Array.isArray(categories) && categories.length > 0) {
      catArray = categories;
    } else if (typeof category === 'string' && category.trim()) {
      catArray = category.split(',').map(s => s.trim()).filter(Boolean);
    }

    const catString = catArray.length > 0 ? catArray.join(', ') : (category || '');

    if (!name || (!catString && catArray.length === 0) || !unit || price === undefined || !linkedVendor) {
      return res.status(400).json({ error: 'All product details (name, category, unit, price, supplier) are required' });
    }

    const product = new Product({
      name,
      category: catString,
      categories: catArray.length > 0 ? catArray : [catString],
      unit,
      price,
      currentStock: currentStock || 0,
      lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 10,
      linkedVendor,
      hsnCode: hsnCode || '3004'
    });

    await product.save();

    // Log initial stock
    if (currentStock > 0) {
      await StockHistory.create({
        product: product._id,
        quantity: currentStock,
        type: 'in',
        reason: 'purchase'
      });
    }

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate('linkedVendor', 'name gstNumber gstType');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { categories, category, ...rest } = req.body;
    let updatePayload = { ...rest };

    if (categories !== undefined || category !== undefined) {
      let catArray = [];
      if (Array.isArray(categories) && categories.length > 0) {
        catArray = categories;
      } else if (typeof category === 'string' && category.trim()) {
        catArray = category.split(',').map(s => s.trim()).filter(Boolean);
      }
      updatePayload.categories = catArray;
      updatePayload.category = catArray.length > 0 ? catArray.join(', ') : (category || '');
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updatePayload, { new: true }).populate('linkedVendor', 'name gstNumber gstType');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const { quantity, type, reason } = req.body; // type: 'in' | 'out', reason: 'purchase' | 'adjustment' | etc
    if (!quantity || !type || !reason) {
      return res.status(400).json({ error: 'Quantity, type, and reason are required' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let diff = Number(quantity);
    if (type === 'out') {
      if (product.currentStock < diff) {
        return res.status(400).json({ error: 'Insufficient stock available' });
      }
      product.currentStock -= diff;
    } else {
      product.currentStock += diff;
    }

    await product.save();

    // Save history
    const log = await StockHistory.create({
      product: product._id,
      quantity: diff,
      type,
      reason
    });

    // Check low stock threshold and alert
    if (product.currentStock <= product.lowStockThreshold) {
      // Create notification
      const exists = await Notification.findOne({ type: 'low_stock', relatedId: product._id, read: false });
      if (!exists) {
        await Notification.create({
          title: 'Low Stock Alert',
          message: `Product "${product.name}" has reached low stock: ${product.currentStock} ${product.unit} remaining.`,
          type: 'low_stock',
          relatedId: product._id
        });
      }
    }

    res.json({ product, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== ORDERS & WORKFLOW ====================

exports.createOrder = async (req, res) => {
  try {
    let { customer, items, deliveryDate, isRecurring, recurringIntervalDays } = req.body;
    
    // If user is a Customer, force customer ID and status
    let initialStatus = 'Pending';
    if (req.user && req.user.role === 'Customer') {
      customer = req.user.id;
      initialStatus = 'Requested';
    }

    if (!customer || !items || !items.length || !deliveryDate) {
      return res.status(400).json({ error: 'Customer, items list, and delivery date are required' });
    }

    let totalAmount = 0;
    const formattedItems = [];

    // Credit limit check
    const custDoc = await Customer.findById(customer);
    if (!custDoc) return res.status(404).json({ error: 'Customer not found' });

    // Verify stock and fetch prices
    for (const item of items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      if (p.currentStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product: ${p.name}` });
      }
      
      const lineTotal = p.price * item.quantity;
      totalAmount += lineTotal;

      formattedItems.push({
        product: p._id,
        quantity: item.quantity,
        price: p.price,
        vendor: p.linkedVendor
      });
    }

    if (custDoc.creditLimit && custDoc.creditLimit > 0) {
      if (custDoc.outstanding + totalAmount > custDoc.creditLimit) {
        return res.status(400).json({ error: `Order exceeds customer credit limit. Limit: Rs.${custDoc.creditLimit}, Outstanding: Rs.${custDoc.outstanding}, Order: Rs.${totalAmount}` });
      }
    }

    const order = new Order({
      customer,
      items: formattedItems,
      totalAmount,
      deliveryDate: new Date(deliveryDate),
      status: initialStatus,
      isRecurring: isRecurring || false,
      recurringIntervalDays: recurringIntervalDays || 30,
      statusHistory: [{ status: initialStatus, updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
    });

    await order.save();

    // Trigger WhatsApp notification for order creation
    if (custDoc && custDoc.mobile) {
      const orderRef = `ORD-${order._id.toString().substring(18).toUpperCase()}`;
      notificationService.sendOrderCreated(custDoc.mobile, orderRef, totalAmount).catch(e => console.error(e));
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, staffId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (staffId) filter.assignedStaff = staffId;

    const orders = await Order.find(filter)
      .populate('customer')
      .populate('assignedStaff', 'name mobile')
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignOrderStaff = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ error: 'Staff ID is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'staff') {
      return res.status(400).json({ error: 'Invalid staff member selected' });
    }

    order.assignedStaff = staff._id;
    order.status = 'Assigned';
    order.statusHistory.push({
      status: 'Assigned',
      updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
    });

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, deliveryProofUrl, signatureUrl } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const order = await Order.findById(req.params.id).populate('customer');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const oldStatus = order.status;
    order.status = status;
    
    if (deliveryProofUrl) order.deliveryProofUrl = deliveryProofUrl;
    if (signatureUrl) order.signatureUrl = signatureUrl;

    if (status === 'Delivered') {
      order.deliveredAt = new Date();

      // Deduct stock and log stock outgoing history when delivered
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.currentStock = Math.max(0, product.currentStock - item.quantity);
          await product.save();
          
          await StockHistory.create({
            product: product._id,
            quantity: item.quantity,
            type: 'out',
            reason: 'sale'
          });

          // Check low stock
          if (product.currentStock <= product.lowStockThreshold) {
            await Notification.create({
              title: 'Low Stock Alert',
              message: `Product "${product.name}" has reached low stock: ${product.currentStock} remaining.`,
              type: 'low_stock',
              relatedId: product._id
            });
          }
        }
      }

      // Automatically convert Order to a Paid or Unpaid Bill
      // Generate Invoice sequence
      const invoiceCount = await Bill.countDocuments({});
      const invoiceNumber = `INV-${Date.now().toString().substring(7)}-${invoiceCount + 1}`;
      
      const subtotal = order.totalAmount;
      const cgstTotal = subtotal * 0.09; // 9% CGST standard default
      const sgstTotal = subtotal * 0.09; // 9% SGST standard default
      const totalAmount = subtotal + cgstTotal + sgstTotal;

      const billItems = order.items.map(i => ({
        product: i.product,
        quantity: i.quantity,
        price: i.price,
        cgst: 9,
        sgst: 9
      }));

      const bill = new Bill({
        invoiceNumber,
        order: order._id,
        customer: order.customer._id,
        items: billItems,
        subtotal,
        cgstTotal,
        sgstTotal,
        totalAmount,
        status: 'Unpaid'
      });
      await bill.save();

      // Create Admin Dashboard notification in real-time
      await Notification.create({
        title: 'Order Delivered 🎉',
        message: `Order ORD-${order._id.toString().substring(18).toUpperCase()} for customer "${order.customer.name}" was marked DELIVERED. Invoice ${invoiceNumber} created.`,
        type: 'delivery',
        relatedId: order._id
      });
    }

    order.statusHistory.push({
      status,
      updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
    });

    await order.save();

    // Trigger WhatsApp notifications based on status change
    if (order.customer && order.customer.mobile) {
      const orderRef = `ORD-${order._id.toString().substring(18).toUpperCase()}`;
      if (status === 'Out for Delivery' && oldStatus !== 'Out for Delivery') {
        notificationService.sendOutForDelivery(order.customer.mobile, orderRef).catch(e => console.error(e));
      } else if (status === 'Delivered' && oldStatus !== 'Delivered') {
        notificationService.sendOrderDelivered(order.customer.mobile, orderRef).catch(e => console.error(e));
      }
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name mobile')
      .populate('items.product', 'name');
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    res.json({
      id: order._id,
      status: order.status,
      customer: order.customer.name,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      items: order.items.map(i => ({ name: i.product.name, quantity: i.quantity })),
      statusHistory: order.statusHistory,
      latitude: order.latitude,
      longitude: order.longitude,
      deliveredAt: order.deliveredAt,
      deliveryProofUrl: order.deliveryProofUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.latitude = latitude;
    order.longitude = longitude;
    await order.save();
    
    res.json({ message: 'Location updated', latitude, longitude });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitOrderFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.feedbackRating = rating;
    order.feedbackComment = comment;
    await order.save();
    
    res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== QUOTATION & BILLING ====================

exports.createQuotation = async (req, res) => {
  try {
    const { customer, items, validDays } = req.body;
    if (!customer || !items || !items.length) {
      return res.status(400).json({ error: 'Customer and items are required' });
    }

    let totalAmount = 0;
    const qItems = [];
    for (const item of items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      const finalPrice = item.price !== undefined ? Number(item.price) : p.price;
      totalAmount += finalPrice * item.quantity;
      qItems.push({
        product: p._id,
        quantity: item.quantity,
        price: finalPrice
      });
    }

    const validity = new Date();
    validity.setDate(validity.getDate() + (Number(validDays) || 15));

    const quotation = new Quotation({
      customer,
      items: qItems,
      totalAmount,
      validUntil: validity
    });

    await quotation.save();
    res.status(201).json(quotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({})
      .populate('customer')
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (quotation.status !== 'Draft') {
      return res.status(400).json({ error: 'Only draft quotations can be edited' });
    }

    const { customer, validDays, items } = req.body;
    
    // Recalculate total amount
    let totalAmount = 0;
    const formattedItems = [];
    for (const item of items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      const finalPrice = item.price !== undefined ? Number(item.price) : p.price;
      totalAmount += finalPrice * item.quantity;
      formattedItems.push({
        product: p._id,
        quantity: item.quantity,
        price: finalPrice
      });
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (Number(validDays) || 15));

    quotation.customer = customer || quotation.customer;
    quotation.items = formattedItems;
    quotation.totalAmount = totalAmount;
    quotation.validUntil = validUntil;

    await quotation.save();
    res.json({ message: 'Quotation updated successfully', quotation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.convertQuotationToOrder = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'Quotation already converted' });
    }

    // Check stock first
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      if (p.currentStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for: ${p.name}` });
      }
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 2); // Default 2 days delivery

    const formattedItems = [];
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      formattedItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        vendor: p.linkedVendor
      });
    }

    const { isRecurring, recurringIntervalDays } = req.body;

    const order = new Order({
      customer: quotation.customer,
      items: formattedItems,
      totalAmount: quotation.totalAmount,
      deliveryDate,
      status: 'Pending',
      isRecurring: isRecurring || false,
      recurringIntervalDays: recurringIntervalDays || 30,
      statusHistory: [{ status: 'Pending', updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
    });

    await order.save();
    
    quotation.status = 'Converted';
    await quotation.save();

    res.json({ message: 'Converted to order successfully', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const bills = await Bill.find({})
      .populate('customer')
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBillPDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!bill) return res.status(404).json({ error: 'Bill invoice not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Invoice_${bill.invoiceNumber}.pdf`);
    
    pdfService.generateBillPDF(bill, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Quotation_${quotation._id}.pdf`);

    pdfService.generateQuotationPDF(quotation, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PAYMENTS ====================

exports.recordPayment = async (req, res) => {
  try {
    const { billId, customerId, amountPaid, paymentMode, referenceNumber, notes, autoAllocate } = req.body;
    
    if (!amountPaid || !paymentMode) {
      return res.status(400).json({ error: 'Amount paid and payment mode are required' });
    }

    if (autoAllocate && customerId) {
      // Auto-reconciliation (FIFO)
      const bills = await Bill.find({ 
        customer: customerId, 
        status: { $in: ['Unpaid', 'Partially Paid'] } 
      }).sort({ createdAt: 1 });

      let remainingAmount = Number(amountPaid);
      const allocatedPayments = [];

      for (let b of bills) {
        if (remainingAmount <= 0) break;
        
        const past = await Payment.find({ bill: b._id });
        const paidSoFar = past.reduce((sum, p) => sum + p.amountPaid, 0);
        const outstanding = b.totalAmount - paidSoFar;
        
        if (outstanding <= 0) continue;
        
        const amountToAllocate = Math.min(outstanding, remainingAmount);
        remainingAmount -= amountToAllocate;
        
        const payment = new Payment({
          bill: b._id,
          order: b.order,
          customer: b.customer,
          amountPaid: amountToAllocate,
          paymentMode,
          referenceNumber,
          notes: (notes || '') + ' (Auto-allocated)'
        });
        await payment.save();
        allocatedPayments.push(payment);
        
        const grandPaid = paidSoFar + amountToAllocate;
        b.status = grandPaid >= b.totalAmount ? 'Paid' : 'Partially Paid';
        await b.save();
      }
      
      return res.status(201).json({ message: 'Auto-allocated successfully', allocatedPayments, unallocatedAmount: remainingAmount });
    }

    // Normal single-bill payment
    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required for direct payment' });
    }

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: 'Invoice bill not found' });

    // Calculate current amount paid so far
    const pastPayments = await Payment.find({ bill: bill._id });
    const totalPaidSoFar = pastPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    const payment = new Payment({
      bill: bill._id,
      order: bill.order,
      customer: bill.customer,
      amountPaid: Number(amountPaid),
      paymentMode,
      referenceNumber,
      notes,
      date: new Date()
    });

    await payment.save();

    // Try sending payment receipt via whatsapp
    const cust = await Customer.findById(bill.customer);
    if (cust && cust.mobile) {
      notificationService.sendPaymentReceived(cust.mobile, amountPaid).catch(e => console.error(e));
    }

    // Update bill payment status
    const grandPaid = totalPaidSoFar + Number(amountPaid);
    if (grandPaid >= bill.totalAmount) {
      bill.status = 'Paid';
    } else if (grandPaid > 0) {
      bill.status = 'Partially Paid';
    } else {
      bill.status = 'Unpaid';
    }

    await bill.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate('customer')
      .populate('bill')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendPaymentReminder = async (req, res) => {
  try {
    const { customerId, language, outstandingAmount } = req.body;
    if (!customerId || !language) {
      return res.status(400).json({ error: 'Customer ID and language template selection are required' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const settings = await Setting.findOne({}) || new Setting();

    let template = settings.smsTemplates[language] || settings.smsTemplates.english;
    
    // Replace variables
    let text = template
      .replace('{customer_name}', customer.name)
      .replace('{amount}', outstandingAmount)
      .replace('{company_name}', settings.companyName);

    const notifyResult = await notificationService.sendMessage(customer.mobile, text);

    res.json({ message: 'Reminder message sent successfully', text, result: notifyResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== SETTINGS ====================

exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({});
    if (!settings) {
      settings = new Setting({});
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({});
    if (!settings) {
      settings = new Setting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendWhatsappMessage = async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing to or message parameters' });
    }

    const settings = await Setting.findOne({});
    
    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(to, message);
        return res.json({ success: true, provider: 'local' });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API is not configured. Please set the Phone ID and Token in settings.' });
    }

    // Default to Meta Cloud API format
    const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
    
    // Using native fetch to avoid adding axios dependency if it doesn't exist
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Failed to send WhatsApp message' });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('WhatsApp Error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getWhatsappStatus = (req, res) => {
  const status = whatsappClient.getStatus();
  res.json(status);
};

exports.logoutWhatsapp = async (req, res) => {
  const success = await whatsappClient.logout();
  res.json({ success });
};

// ==================== REPORTS ====================

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = eDate;
      }
    }
    const bills = await Bill.find(filter).populate('customer').sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const products = await Product.find({}).populate('linkedVendor', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDeliveryReport = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.deliveryDate = {};
      if (startDate) filter.deliveryDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.deliveryDate.$lte = eDate;
      }
    }
    if (staffId) filter.assignedStaff = staffId;

    const orders = await Order.find(filter)
      .populate('customer')
      .populate('assignedStaff', 'name mobile')
      .sort({ deliveryDate: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOutstandingReport = async (req, res) => {
  try {
    const customers = await Customer.find({});
    const outstandingList = [];

    for (const customer of customers) {
      const bills = await Bill.find({ customer: customer._id });
      const payments = await Payment.find({ customer: customer._id });

      const totalSales = bills.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const dues = Math.max(0, totalSales - totalPaid);

      if (dues > 0) {
        outstandingList.push({
          customer: {
            _id: customer._id,
            name: customer.name,
            mobile: customer.mobile,
            address: customer.address
          },
          totalSales,
          totalPaid,
          outstandingAmount: dues
        });
      }
    }
    res.json(outstandingList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const { customerId, pdf } = req.query;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const bills = await Bill.find({ customer: customer._id }).sort({ createdAt: 1 });
    const payments = await Payment.find({ customer: customer._id }).sort({ date: 1 });

    const ledger = [];
    bills.forEach(b => {
      ledger.push({
        date: b.createdAt,
        type: 'Invoice Bill',
        ref: b.invoiceNumber,
        debit: b.totalAmount,
        credit: 0
      });
    });

    payments.forEach(p => {
      ledger.push({
        date: p.date,
        type: 'Payment Received',
        ref: p.referenceNumber || 'Cash/UPI',
        debit: 0,
        credit: p.amountPaid
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return {
        ...entry,
        runningBalance
      };
    });

    if (pdf === 'true') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=statement_${customer.mobile}.pdf`);
      return pdfService.generateCustomerStatementPDF(customer, ledgerWithBalance, res);
    }

    res.json({ customer, ledger: ledgerWithBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== STAFF MANAGEMENT ====================

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ error: 'Name, email, password, and mobile are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const staff = new User({
      name,
      email,
      password,
      mobile,
      role: 'staff',
      status: 'Active'
    });

    await staff.save();
    
    res.status(201).json({
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      mobile: staff.mobile,
      role: staff.role,
      status: staff.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStaffList = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStaffStatus = async (req, res) => {
  try {
    const { status } = req.body; // Active | Inactive
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const staff = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processRecurringOrders = async (req, res) => {
  try {
    const deliveredOrders = await Order.find({
      isRecurring: true,
      status: 'Delivered',
      recurringProcessed: false
    });

    const newlyCreated = [];
    const now = new Date();

    for (const order of deliveredOrders) {
      if (!order.deliveredAt) continue;

      const triggerDate = new Date(order.deliveredAt.getTime() + order.recurringIntervalDays * 24 * 60 * 60 * 1000);
      
      if (now >= triggerDate) {
        // Time to duplicate
        const newOrder = new Order({
          customer: order.customer,
          items: order.items,
          totalAmount: order.totalAmount,
          deliveryDate: now,
          status: 'Pending',
          isRecurring: true,
          recurringIntervalDays: order.recurringIntervalDays,
          recurringSourceOrder: order._id,
          statusHistory: [{ status: 'Pending', updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
        });
        
        await newOrder.save();
        
        // Mark old as processed
        order.recurringProcessed = true;
        await order.save();

        // Create Notification
        const customerDetails = await Customer.findById(order.customer);
        if (customerDetails) {
          await Notification.create({
            title: 'Automated Order Loop Triggered',
            message: `A new recurring order loop was generated automatically for customer: ${customerDetails.name}`,
            type: 'delivery_reminder',
            relatedId: newOrder._id
          });
        }

        newlyCreated.push(newOrder);
      }
    }

    res.json({ message: `Processed ${newlyCreated.length} recurring orders successfully.`, newOrders: newlyCreated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processSingleRecurringOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.isRecurring || order.recurringProcessed) {
      return res.status(400).json({ error: 'Order is not eligible for recurring processing' });
    }

    const now = new Date();
    const newOrder = new Order({
      customer: order.customer,
      items: order.items,
      totalAmount: order.totalAmount,
      deliveryDate: now,
      status: 'Pending',
      isRecurring: true,
      recurringIntervalDays: order.recurringIntervalDays,
      recurringSourceOrder: order._id,
      statusHistory: [{ status: 'Pending', updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
    });
    
    await newOrder.save();
    
    order.recurringProcessed = true;
    await order.save();

    const customerDetails = await Customer.findById(order.customer);
    if (customerDetails) {
      await Notification.create({
        title: 'Manual Order Loop Triggered',
        message: `A new recurring order loop was generated manually for customer: ${customerDetails.name}`,
        type: 'delivery_reminder',
        relatedId: newOrder._id
      });
    }

    res.json({ message: 'Recurring order loop generated successfully!', newOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

