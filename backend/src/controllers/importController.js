const XLSX = require('xlsx');
const Product = require('../models/product');
const Vendor = require('../models/vendor');
const Customer = require('../models/customer');
const Category = require('../models/category');
const Unit = require('../models/unit');
const HsnCode = require('../models/hsnCode');

function normalizeKey(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Sample Templates Data Definitions
const TEMPLATES = {
  products: {
    filename: 'Sample_Products_Import.xlsx',
    headers: ['Product Name', 'Category', 'Unit', 'Retail Price', 'Initial Stock', 'Reorder Level', 'HSN Code', 'Supplier Name'],
    sampleRows: [
      ['Paracetamol 500mg', 'Tablet, Medicine', 'Strip', 25.50, 100, 20, '3004', 'PharmaCare Wholesalers'],
      ['Amoxicillin 250mg', 'Capsule, Medicine', 'Strip', 45.00, 50, 10, '3004', 'PharmaCare Wholesalers']
    ]
  },
  suppliers: {
    filename: 'Sample_Suppliers_Import.xlsx',
    headers: ['Supplier Name', 'Contact Mobile', 'Address', 'GST Type', 'GSTIN Number', 'Categories Supplied'],
    sampleRows: [
      ['Apex Pharma Distributors', '9876543210', '123 Industrial Area, Pune', 'Regular', '27AAAAA0000A1Z5', 'Medicine, Surgical'],
      ['Generic Meds India', '9123456789', '45 Commercial Hub, Mumbai', 'Composition', '27BBBBB1111B2Z6', 'Consumables']
    ]
  },
  customers: {
    filename: 'Sample_Customers_Import.xlsx',
    headers: ['Customer Name', 'Mobile Number', 'Address', 'GSTIN Number', 'Credit Limit'],
    sampleRows: [
      ['City Healthcare Clinic', '9822012345', '78 Station Road, Pune', '27CCCCC2222C3Z7', 50000],
      ['Dr. Sharma Pharmacy', '9890123456', '12 Market Square, Nagpur', '', 25000]
    ]
  },
  categories: {
    filename: 'Sample_Categories_Import.xlsx',
    headers: ['Category Name', 'Status'],
    sampleRows: [
      ['Antibiotics', 'Active'],
      ['Ayurvedic', 'Active']
    ]
  },
  units: {
    filename: 'Sample_Units_Import.xlsx',
    headers: ['Unit Name', 'Status'],
    sampleRows: [
      ['Blister', 'Active'],
      ['Sachet', 'Active']
    ]
  },
  hsncodes: {
    filename: 'Sample_HSN_Codes_Import.xlsx',
    headers: ['HSN Code', 'Status'],
    sampleRows: [
      ['3005', 'Active'],
      ['3006', 'Active']
    ]
  }
};

// GET /import/sample/:module
exports.downloadSampleTemplate = async (req, res) => {
  try {
    const { module: modName } = req.params;
    const template = TEMPLATES[modName.toLowerCase()];

    if (!template) {
      return res.status(400).json({ error: `Invalid module. Supported modules: ${Object.keys(TEMPLATES).join(', ')}` });
    }

    const wsData = [template.headers, ...template.sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /import/:module
exports.importExcelData = async (req, res) => {
  try {
    const { module: modName } = req.params;
    const key = modName.toLowerCase();

    if (!TEMPLATES[key]) {
      return res.status(400).json({ error: `Invalid module. Supported modules: ${Object.keys(TEMPLATES).join(', ')}` });
    }

    let fileBuffer = null;

    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.body && req.body.fileData) {
      // Base64 file string support
      const base64Str = req.body.fileData.replace(/^data:.*?;base64,/, '');
      fileBuffer = Buffer.from(base64Str, 'base64');
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No Excel file provided' });
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty' });
    }

    let successCount = 0;
    const skippedRows = [];

    // Process rows depending on module
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Row 1 is header

      try {
        if (key === 'categories') {
          const rawName = String(row['Category Name'] || row['name'] || '').trim();
          if (!rawName) {
            skippedRows.push({ row: rowNum, data: row, reason: 'Category Name is missing' });
            continue;
          }
          const nameLower = normalizeKey(rawName);
          const existing = await Category.findOne({ nameLower });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `Category "${rawName}" already exists` });
            continue;
          }
          const status = String(row['Status'] || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active';
          await Category.create({ name: rawName, nameLower, status });
          successCount++;
        }

        else if (key === 'units') {
          const rawName = String(row['Unit Name'] || row['name'] || '').trim();
          if (!rawName) {
            skippedRows.push({ row: rowNum, data: row, reason: 'Unit Name is missing' });
            continue;
          }
          const nameLower = normalizeKey(rawName);
          const existing = await Unit.findOne({ nameLower });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `Unit "${rawName}" already exists` });
            continue;
          }
          const status = String(row['Status'] || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active';
          await Unit.create({ name: rawName, nameLower, status });
          successCount++;
        }

        else if (key === 'hsncodes') {
          const rawCode = String(row['HSN Code'] || row['code'] || '').trim();
          if (!rawCode) {
            skippedRows.push({ row: rowNum, data: row, reason: 'HSN Code is missing' });
            continue;
          }
          const codeLower = normalizeKey(rawCode);
          const existing = await HsnCode.findOne({ codeLower });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `HSN Code "${rawCode}" already exists` });
            continue;
          }
          const status = String(row['Status'] || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active';
          await HsnCode.create({ code: rawCode, codeLower, status });
          successCount++;
        }

        else if (key === 'suppliers') {
          const name = String(row['Supplier Name'] || row['name'] || '').trim();
          const contact = String(row['Contact Mobile'] || row['contact'] || '').trim().replace(/\D/g, '');
          const address = String(row['Address'] || row['address'] || '').trim();
          const gstType = String(row['GST Type'] || 'Regular').trim();
          const gstNumber = String(row['GSTIN Number'] || row['gstNumber'] || '').trim().toUpperCase();
          const catStr = String(row['Categories Supplied'] || '').trim();

          if (!name || !contact || !address) {
            skippedRows.push({ row: rowNum, data: row, reason: 'Name, contact (10 digits), and address are required' });
            continue;
          }
          const existing = await Vendor.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `Supplier "${name}" already exists` });
            continue;
          }

          const itemCategories = catStr ? catStr.split(',').map(s => s.trim()).filter(Boolean) : [];
          await Vendor.create({ name, contact, address, gstType, gstNumber, itemCategories });
          successCount++;
        }

        else if (key === 'customers') {
          const name = String(row['Customer Name'] || row['name'] || '').trim();
          const mobile = String(row['Mobile Number'] || row['mobile'] || '').trim().replace(/\D/g, '');
          const address = String(row['Address'] || row['address'] || '').trim();
          const gstNumber = String(row['GSTIN Number'] || row['gstNumber'] || '').trim().toUpperCase();
          const creditLimit = Number(row['Credit Limit']) || 0;

          if (!name || !mobile || mobile.length !== 10 || !address) {
            skippedRows.push({ row: rowNum, data: row, reason: 'Valid Name, 10-digit Mobile, and Address are required' });
            continue;
          }

          const existing = await Customer.findOne({ mobile });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `Customer with mobile ${mobile} already exists` });
            continue;
          }

          await Customer.create({ name, mobile, address, gstNumber, creditLimit, role: 'Customer' });
          successCount++;
        }

        else if (key === 'products') {
          const name = String(row['Product Name'] || row['name'] || '').trim();
          const catStr = String(row['Category'] || row['category'] || '').trim();
          const unit = String(row['Unit'] || row['unit'] || 'Strip').trim();
          const price = Number(row['Retail Price'] || row['price']) || 0;
          const currentStock = Number(row['Initial Stock'] || row['currentStock']) || 0;
          const lowStockThreshold = Number(row['Reorder Level'] || row['lowStockThreshold']) || 10;
          const hsnCode = String(row['HSN Code'] || row['hsnCode'] || '3004').trim();
          const supplierName = String(row['Supplier Name'] || row['supplier'] || '').trim();

          if (!name || !catStr || price <= 0) {
            skippedRows.push({ row: rowNum, data: row, reason: 'Product Name, Category, and Price (>0) are required' });
            continue;
          }

          const existing = await Product.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
          if (existing) {
            skippedRows.push({ row: rowNum, data: row, reason: `Product "${name}" already exists` });
            continue;
          }

          // Resolve linked vendor
          let vendorObj = null;
          if (supplierName) {
            vendorObj = await Vendor.findOne({ name: { $regex: supplierName, $options: 'i' } });
          }
          if (!vendorObj) {
            vendorObj = await Vendor.findOne({});
          }

          if (!vendorObj) {
            skippedRows.push({ row: rowNum, data: row, reason: 'No valid Supplier found to link product' });
            continue;
          }

          const categories = catStr.split(',').map(s => s.trim()).filter(Boolean);

          await Product.create({
            name,
            category: categories.join(', '),
            categories,
            unit,
            price,
            currentStock,
            lowStockThreshold,
            hsnCode,
            linkedVendor: vendorObj._id
          });
          successCount++;
        }

      } catch (rowErr) {
        skippedRows.push({ row: rowNum, data: row, reason: rowErr.message });
      }
    }

    res.json({
      module: modName,
      totalRows: rows.length,
      successCount,
      failedCount: skippedRows.length,
      skippedRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
