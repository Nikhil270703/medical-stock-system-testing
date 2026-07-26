const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const shopController = require('../controllers/shopController');
const advancedShopController = require('../controllers/advancedShopController');
const paymentGatewayController = require('../controllers/paymentGatewayController');
const masterController = require('../controllers/masterController');
const importController = require('../controllers/importController');

// ==================== EXCEL BULK IMPORT ====================
router.get('/import/sample/:module', auth.verifyToken, importController.downloadSampleTemplate);
router.post('/import/:module', auth.verifyToken, importController.importExcelData);

// ==================== MASTER DATA MANAGEMENT ====================
// Categories
router.get('/categories', auth.verifyToken, masterController.getCategories);
router.get('/categories/:id', auth.verifyToken, masterController.getCategoryById);
router.post('/categories', auth.verifyToken, masterController.createCategory);
router.put('/categories/:id', auth.verifyToken, masterController.updateCategory);
router.delete('/categories/:id', auth.verifyToken, masterController.deleteCategory);

// Units
router.get('/units', auth.verifyToken, masterController.getUnits);
router.get('/units/:id', auth.verifyToken, masterController.getUnitById);
router.post('/units', auth.verifyToken, masterController.createUnit);
router.put('/units/:id', auth.verifyToken, masterController.updateUnit);
router.delete('/units/:id', auth.verifyToken, masterController.deleteUnit);

// HSN Codes
router.get('/hsncodes', auth.verifyToken, masterController.getHsnCodes);
router.get('/hsncodes/:id', auth.verifyToken, masterController.getHsnCodeById);
router.post('/hsncodes', auth.verifyToken, masterController.createHsnCode);
router.put('/hsncodes/:id', auth.verifyToken, masterController.updateHsnCode);
router.delete('/hsncodes/:id', auth.verifyToken, masterController.deleteHsnCode);

// ==================== AUTH ROUTES ====================

router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/me', auth.verifyToken, authController.me);

router.post('/auth/customer/login', authController.loginCustomer);

// ==================== DASHBOARD & NOTIFICATIONS ====================
router.get('/dashboard/stats', auth.verifyToken, shopController.getDashboardStats);
router.get('/notifications', auth.verifyToken, shopController.getNotifications);
router.put('/notifications/:id/read', auth.verifyToken, shopController.markNotificationRead);

// ==================== CUSTOMERS ====================
router.post('/customers', auth.verifyToken, shopController.createCustomer);
router.get('/customers', auth.verifyToken, shopController.getCustomers);
router.get('/customers/:id', auth.verifyToken, shopController.getCustomerProfile);
router.put('/customers/:id', auth.verifyToken, shopController.updateCustomer);
router.delete('/customers/:id', auth.verifyToken, shopController.deleteCustomer);

// ==================== VENDORS ====================
router.post('/vendors', auth.verifyToken, shopController.createVendor);
router.get('/vendors', auth.verifyToken, shopController.getVendors);
router.put('/vendors/:id', auth.verifyToken, shopController.updateVendor);
router.delete('/vendors/:id', auth.verifyToken, shopController.deleteVendor);

// ==================== PRODUCTS ====================
router.post('/products', auth.verifyToken, shopController.createProduct);
router.get('/products', auth.verifyToken, shopController.getProducts);
router.put('/products/:id', auth.verifyToken, shopController.updateProduct);
router.put('/products/:id/adjust', auth.verifyToken, shopController.adjustStock);
router.delete('/products/:id', auth.verifyToken, shopController.deleteProduct);

// ==================== ORDERS ====================
router.post('/orders', auth.verifyToken, shopController.createOrder);
router.get('/orders', auth.verifyToken, shopController.getOrders);
router.post('/orders/process-recurring', auth.verifyToken, shopController.processRecurringOrders);
router.post('/orders/:id/process-loop-now', auth.verifyToken, shopController.processSingleRecurringOrder);
router.put('/orders/:id/assign', auth.verifyToken, shopController.assignOrderStaff);
router.put('/orders/:id/status', auth.verifyToken, shopController.updateOrderStatus);
router.put('/orders/:id/location', auth.verifyToken, shopController.updateOrderLocation);

// Public tracking and feedback
router.get('/track/:id', shopController.trackOrder);
router.post('/orders/:id/feedback', shopController.submitOrderFeedback);

// ==================== QUOTATIONS & BILLING ====================
router.post('/quotations', auth.verifyToken, shopController.createQuotation);
router.get('/quotations', auth.verifyToken, shopController.getQuotations);
router.put('/quotations/:id', auth.verifyToken, shopController.updateQuotation);
router.post('/quotations/:id/convert', auth.verifyToken, shopController.convertQuotationToOrder);
router.post('/quotations/:id/whatsapp', auth.verifyToken, advancedShopController.sendQuotationWhatsapp);
router.get('/bills', auth.verifyToken, shopController.getBills);
router.get('/bills/:id/pdf', shopController.getBillPDF); // public PDF streaming download
router.get('/quotations/:id/pdf', shopController.getQuotationPDF); // public PDF streaming download

// ==================== PAYMENTS ====================
router.post('/payments', auth.verifyToken, shopController.recordPayment);
router.get('/payments', auth.verifyToken, shopController.getPayments);
router.post('/payments/reminder', auth.verifyToken, shopController.sendPaymentReminder);

// Payment Gateway routes
router.post('/payments/create-link', paymentGatewayController.createPaymentLink); // can be public or auth
router.post('/payments/verify', paymentGatewayController.verifyPayment); // webhook / callback

// ==================== SETTINGS & INTEGRATIONS ====================
router.get('/settings', auth.verifyToken, shopController.getSettings);
router.put('/settings', auth.verifyToken, shopController.updateSettings);
router.post('/whatsapp/send', auth.verifyToken, shopController.sendWhatsappMessage);
router.get('/whatsapp/status', auth.verifyToken, shopController.getWhatsappStatus);
router.post('/whatsapp/logout', auth.verifyToken, shopController.logoutWhatsapp);

// ==================== REPORTS ====================
router.get('/reports/sales', auth.verifyToken, shopController.getSalesReport);
router.get('/reports/stock', auth.verifyToken, shopController.getStockReport);
router.get('/reports/delivery', auth.verifyToken, shopController.getDeliveryReport);
router.get('/reports/outstanding', auth.verifyToken, shopController.getOutstandingReport);
router.get('/reports/ledger', auth.verifyToken, shopController.getCustomerLedgerReport);

// ==================== STAFF (Basic) ====================
router.post('/staff', auth.verifyToken, shopController.createStaff);
router.get('/staff', auth.verifyToken, shopController.getStaffList);
router.put('/staff/:id/status', auth.verifyToken, shopController.updateStaffStatus);

// ==================== ADVANCED SHOP MODULES ====================

// 1. Branches
router.post('/branches', auth.verifyToken, advancedShopController.createBranch);
router.get('/branches', auth.verifyToken, advancedShopController.getBranches);

// 2. Employees (Formal Module)
router.post('/employees', auth.verifyToken, advancedShopController.createEmployee);
router.get('/employees', auth.verifyToken, advancedShopController.getEmployees);
router.put('/employees/:id', auth.verifyToken, advancedShopController.updateEmployee);
router.delete('/employees/:id', auth.verifyToken, advancedShopController.deleteEmployee);
router.get('/employees/performance', auth.verifyToken, advancedShopController.getEmployeePerformance);

// 3. Quotation → Invoice Conversion (Formal link)
router.post('/quotations/:id/convert-invoice', auth.verifyToken, advancedShopController.convertQuotationToInvoice);

// 4. Procurement & Purchase Orders (Suppliers PO)
router.post('/purchases', auth.verifyToken, advancedShopController.createPurchaseOrder);
router.get('/purchases', auth.verifyToken, advancedShopController.getPurchaseOrders);
router.post('/purchases/:id/whatsapp', auth.verifyToken, advancedShopController.sendPurchaseOrderWhatsapp);
router.put('/purchases/:id/receive', auth.verifyToken, advancedShopController.receivePurchaseOrder);

// 5. Stock Manual Adjustments & Logs
router.put('/products/:id/adjust-manual', auth.verifyToken, advancedShopController.manualAdjustProductStock);
router.get('/products/reorder-list', auth.verifyToken, advancedShopController.getReorderList);
router.get('/products/:id/stock-logs', auth.verifyToken, advancedShopController.getProductStockLog);

router.post('/products/run-recurring-scan', auth.verifyToken, advancedShopController.triggerRecurringScan);

// 6. Expense Management
router.post('/expenses', auth.verifyToken, advancedShopController.createExpense);
router.get('/expenses', auth.verifyToken, advancedShopController.getExpenses);
router.delete('/expenses/:id', auth.verifyToken, advancedShopController.deleteExpense);

// 7. Backup / Restore / Portability
router.get('/data/backup', auth.verifyToken, advancedShopController.exportBackupJSON);
router.post('/data/backup/create', auth.verifyToken, advancedShopController.triggerManualBackup);
router.get('/data/backups/history', auth.verifyToken, advancedShopController.getBackupHistory);
router.get('/data/backups/download/:filename', auth.verifyToken, advancedShopController.downloadBackupFile);
router.post('/data/restore', auth.verifyToken, advancedShopController.importBackupJSON);
router.post('/data/import-bulk', auth.verifyToken, advancedShopController.bulkImportExcel);

// 8. Audit Logs
router.get('/data/audit-logs', auth.verifyToken, advancedShopController.getAuditLogs);

module.exports = router;
