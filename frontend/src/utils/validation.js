// Centralized Client-Side Validation Utility

export const PASSWORD_MIN_LENGTH = 8;
export const MOBILE_LENGTH = 10;
export const GST_LENGTH = 15;

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Sanitizes generic text by trimming and collapsing consecutive whitespace
 */
export function sanitizeText(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitizes email by trimming whitespace and converting to lowercase
 */
export function sanitizeEmail(val) {
  if (typeof val !== 'string') return '';
  return val.trim().toLowerCase();
}

/**
 * Validates text input
 */
export function validateText(val, options = {}) {
  const { required = false, minLength = 0, fieldName = 'This field' } = options;
  const sanitized = sanitizeText(val || '');
  if (required && !sanitized) {
    return `${fieldName} is required`;
  }
  if (sanitized && minLength > 0 && sanitized.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return '';
}

/**
 * Validates email address format
 */
export function validateEmail(val, options = {}) {
  const { required = false } = options;
  const sanitized = sanitizeEmail(val || '');
  if (!sanitized) {
    if (required) return 'Email address is required';
    return '';
  }
  if (!EMAIL_REGEX.test(sanitized)) {
    return 'Please enter a valid email address';
  }
  return '';
}

/**
 * Validates 10-digit Indian Mobile number
 */
export function validateMobile(val, options = {}) {
  const { required = false } = options;
  const str = String(val || '').trim();
  if (!str) {
    if (required) return 'Mobile number is required';
    return '';
  }
  if (str.length !== MOBILE_LENGTH) {
    return `Mobile number must be exactly ${MOBILE_LENGTH} digits`;
  }
  if (!MOBILE_REGEX.test(str)) {
    return 'Enter a valid 10-digit Indian mobile number (starts with 6-9)';
  }
  return '';
}

/**
 * Validates 15-character GSTIN format
 */
export function validateGST(val, options = {}) {
  const { required = false } = options;
  const str = String(val || '').trim().toUpperCase();
  if (!str) {
    if (required) return 'GST number is required';
    return '';
  }
  if (str.length !== GST_LENGTH) {
    return `GST number must be exactly ${GST_LENGTH} characters`;
  }
  if (!GST_REGEX.test(str)) {
    return 'Invalid GST format (e.g. 27ABCDE1234F1Z5)';
  }
  return '';
}

/**
 * Validates password length
 */
export function validatePassword(val, options = {}) {
  const { required = false, minLength = PASSWORD_MIN_LENGTH } = options;
  const str = String(val || '');
  if (!str) {
    if (required) return 'Password is required';
    return '';
  }
  if (str.length < minLength) {
    return `Password must be at least ${minLength} characters (current: ${str.length})`;
  }
  return '';
}

/**
 * Validates numeric fields (Stock, Price, Amount, Credit Limit, etc.)
 */
export function validateNumber(val, options = {}) {
  const { required = false, min = 0, max = Infinity, allowDecimal = true, fieldName = 'Value' } = options;
  const str = String(val === null || val === undefined ? '' : val).trim();
  if (!str) {
    if (required) return `${fieldName} is required`;
    return '';
  }
  const num = Number(str);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  if (!allowDecimal && !Number.isInteger(num)) {
    return `${fieldName} must be a whole number`;
  }
  if (num < min) {
    return `${fieldName} cannot be less than ${min}`;
  }
  if (num > max) {
    return `${fieldName} cannot exceed ${max}`;
  }
  return '';
}

/**
 * Format mobile input by retaining digits only up to 10 digits
 */
export function formatMobileInput(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/\D/g, '').slice(0, MOBILE_LENGTH);
}

/**
 * Format numeric input (non-negative digits and optional decimal)
 */
export function formatNumberInput(val, allowDecimal = true) {
  if (typeof val !== 'string') return String(val || '');
  if (allowDecimal) {
    let cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  }
  return val.replace(/\D/g, '');
}

export function validateGSTIN(gstNumber, gstType = 'Regular') {
  if (gstType === 'Unregistered' || gstType === 'Consumer') {
    return '';
  }
  const clean = typeof gstNumber === 'string' ? gstNumber.trim() : '';
  if (!clean) {
    if (gstType === 'Regular' || gstType === 'Composition') {
      return 'GSTIN Number is required for Regular/Composition suppliers';
    }
    return '';
  }
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  if (!gstRegex.test(clean)) {
    return 'Invalid 15-character GSTIN format (e.g. 27AAAAA0000A1Z5)';
  }
  return '';
}

// ==========================================
// Centralized Form-Level Validators
// ==========================================

export function validateProductForm(data = {}) {
  const hasCategories = (Array.isArray(data.categories) && data.categories.length > 0) || Boolean(typeof data.category === 'string' && data.category.trim());
  return {
    name: validateText(data.name, { required: true, fieldName: 'Product Name' }),
    category: hasCategories ? '' : 'At least one Product Category is required',
    hsnCode: validateText(data.hsnCode, { required: true, fieldName: 'HSN Code' }),
    unit: validateText(data.unit, { required: true, fieldName: 'Unit' }),
    price: validateNumber(data.price, { required: true, min: 0.01, allowDecimal: true, fieldName: 'Retail Price' }),
    currentStock: validateNumber(data.currentStock, { required: true, min: 0, allowDecimal: false, fieldName: 'Initial Stock' }),
    lowStockThreshold: validateNumber(data.lowStockThreshold, { required: true, min: 0, allowDecimal: false, fieldName: 'Reorder Level' }),
    linkedVendor: validateText(data.linkedVendor, { required: true, fieldName: 'Supplier Vendor' })
  };
}

export function validateCustomerForm(data = {}) {
  return {
    name: validateText(data.name, { required: true, fieldName: 'Customer Name' }),
    mobile: validateMobile(data.mobile, { required: true }),
    address: validateText(data.address, { required: true, fieldName: 'Address' }),
    gstNumber: validateGST(data.gstNumber, { required: false }),
    defaultRecurringDays: validateNumber(data.defaultRecurringDays, { required: false, min: 0, allowDecimal: false, fieldName: 'Default Order Loop Days' }),
    creditLimit: validateNumber(data.creditLimit, { required: false, min: 0, allowDecimal: true, fieldName: 'Credit Limit' }),
    password: data.password ? validatePassword(data.password, { required: false }) : ''
  };
}

export function validateVendorForm(data = {}) {
  return {
    name: validateText(data.name, { required: true, fieldName: 'Vendor Name' }),
    contact: validateMobile(data.contact, { required: true }),
    address: validateText(data.address, { required: true, fieldName: 'Address' }),
    gstType: validateText(data.gstType, { required: true, fieldName: 'GST Type' }),
    gstNumber: validateGSTIN(data.gstNumber, data.gstType),
    performanceScore: validateNumber(data.performanceScore, { required: true, min: 0, max: 100, allowDecimal: false, fieldName: 'Performance Score' }),
    qualityRating: validateNumber(data.qualityRating, { required: true, min: 1, max: 5, allowDecimal: false, fieldName: 'Quality Rating' })
  };
}

export function validateEmployeeForm(data = {}) {
  return {
    name: validateText(data.name, { required: true, fieldName: 'Employee Name' }),
    mobile: validateMobile(data.mobile, { required: true }),
    branchId: validateText(data.branchId, { required: true, fieldName: 'Branch' }),
    email: data.email ? validateEmail(data.email, { required: false }) : '',
    password: data.password ? validatePassword(data.password, { required: false }) : ''
  };
}

export function validateBillPaymentForm(data = {}) {
  return {
    amountPaid: validateNumber(data.amountPaid, { required: true, min: 0.01, allowDecimal: true, fieldName: 'Amount Paid' })
  };
}

export function validateOrderForm(selectedCustomerId, deliveryDate, isRecurring = false, recurringIntervalDays = 30, orderItems = []) {
  const errs = {
    customerId: validateText(selectedCustomerId, { required: true, fieldName: 'Customer' }),
    deliveryDate: validateText(deliveryDate, { required: true, fieldName: 'Scheduled Delivery Date' })
  };
  if (isRecurring) {
    errs.recurringIntervalDays = validateNumber(recurringIntervalDays, { required: true, min: 1, allowDecimal: false, fieldName: 'Repeat interval' });
  }
  const invalidItems = orderItems.some(it => !it.product || validateNumber(it.quantity, { required: true, min: 1 }));
  if (invalidItems) errs.items = 'All order items must have a product selected and a valid quantity (>= 1)';
  return errs;
}

export function validatePurchaseForm(selectedSupplierId, expectedDate, branchId, poItems = []) {
  const errs = {
    supplierId: validateText(selectedSupplierId, { required: true, fieldName: 'Supplier' }),
    expectedDate: validateText(expectedDate, { required: true, fieldName: 'Expected Delivery Date' }),
    branchId: validateText(branchId, { required: true, fieldName: 'Receiving Branch' })
  };
  const invalidItems = poItems.some(it => !it.product || validateNumber(it.quantity, { required: true, min: 1 }) || validateNumber(it.costPrice, { required: true, min: 0 }));
  if (invalidItems) errs.items = 'All purchase items must have a product, quantity (>=1), and cost price (>=0)';
  return errs;
}

export function validateQuotationForm(selectedCustomerId, validDays, quotationItems = []) {
  const errs = {
    customerId: validateText(selectedCustomerId, { required: true, fieldName: 'Customer' }),
    validDays: validateNumber(validDays, { required: true, min: 1, allowDecimal: false, fieldName: 'Validity (Days)' })
  };
  const invalidItems = quotationItems.some(it => !it.product || validateNumber(it.quantity, { required: true, min: 1 }) || validateNumber(it.price, { required: true, min: 0 }));
  if (invalidItems) errs.items = 'All line items must have a product, quantity (>= 1), and price (>= 0)';
  return errs;
}

export function validatePaymentForm(data = {}) {
  return {
    customerId: validateText(data.customerId, { required: true, fieldName: 'Customer' }),
    amountPaid: validateNumber(data.amountPaid, { required: true, min: 0.01, allowDecimal: true, fieldName: 'Amount Paid' })
  };
}

export function validateExpenseForm(data = {}) {
  return {
    category: validateText(data.category, { required: true, fieldName: 'Category' }),
    amount: validateNumber(data.amount, { required: true, min: 0.01, allowDecimal: true, fieldName: 'Amount' }),
    branchId: validateText(data.branchId, { required: true, fieldName: 'Branch' })
  };
}

export function validateCustomerOrderBookForm(deliveryDate, isRecurring = false, recurringDays = 30) {
  const errs = {
    deliveryDate: validateText(deliveryDate, { required: true, fieldName: 'Delivery Date' })
  };
  if (isRecurring) {
    errs.recurringDays = validateNumber(recurringDays, { required: true, min: 1, allowDecimal: false, fieldName: 'Recurring Days' });
  }
  return errs;
}

export function validateMasterCategoryForm(data = {}) {
  return {
    name: validateText(data.name, { required: true, fieldName: 'Category Name' })
  };
}

export function validateMasterUnitForm(data = {}) {
  return {
    name: validateText(data.name, { required: true, fieldName: 'Unit Name' })
  };
}

export function validateMasterHsnForm(data = {}) {
  return {
    code: validateText(data.code, { required: true, fieldName: 'HSN Code' })
  };
}



