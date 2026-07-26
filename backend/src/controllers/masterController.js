const Category = require('../models/category');
const Unit = require('../models/unit');
const HsnCode = require('../models/hsnCode');

function normalizeKey(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ==================== CATEGORIES ====================

exports.getCategories = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      const cleanSearch = search.trim();
      query.name = { $regex: cleanSearch, $options: 'i' };
    }

    const categories = await Category.find(query).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, status } = req.body;
    const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';

    if (!cleanName) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const nameLower = normalizeKey(cleanName);
    const existing = await Category.findOne({ nameLower });
    if (existing) {
      return res.status(409).json({ error: `Category "${cleanName}" already exists` });
    }

    const category = new Category({
      name: cleanName,
      nameLower,
      status: status || 'Active'
    });

    await category.save();
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, status } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
      if (!cleanName) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      const nameLower = normalizeKey(cleanName);
      const existing = await Category.findOne({ nameLower, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ error: `Category "${cleanName}" already exists` });
      }
      category.name = cleanName;
      category.nameLower = nameLower;
    }

    if (status && ['Active', 'Inactive'].includes(status)) {
      category.status = status;
    }

    await category.save();
    res.json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== UNITS ====================

exports.getUnits = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      const cleanSearch = search.trim();
      query.name = { $regex: cleanSearch, $options: 'i' };
    }

    const units = await Unit.find(query).sort({ name: 1 });
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const { name, status } = req.body;
    const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';

    if (!cleanName) {
      return res.status(400).json({ error: 'Unit name is required' });
    }

    const nameLower = normalizeKey(cleanName);
    const existing = await Unit.findOne({ nameLower });
    if (existing) {
      return res.status(409).json({ error: `Unit "${cleanName}" already exists` });
    }

    const unit = new Unit({
      name: cleanName,
      nameLower,
      status: status || 'Active'
    });

    await unit.save();
    res.status(201).json(unit);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Unit with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const { name, status } = req.body;
    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
      if (!cleanName) {
        return res.status(400).json({ error: 'Unit name cannot be empty' });
      }
      const nameLower = normalizeKey(cleanName);
      const existing = await Unit.findOne({ nameLower, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ error: `Unit "${cleanName}" already exists` });
      }
      unit.name = cleanName;
      unit.nameLower = nameLower;
    }

    if (status && ['Active', 'Inactive'].includes(status)) {
      unit.status = status;
    }

    await unit.save();
    res.json(unit);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Unit with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const deleted = await Unit.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== HSN CODES ====================

exports.getHsnCodes = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      const cleanSearch = search.trim();
      query.code = { $regex: cleanSearch, $options: 'i' };
    }

    const hsnCodes = await HsnCode.find(query).sort({ code: 1 });
    res.json(hsnCodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHsnCodeById = async (req, res) => {
  try {
    const hsnCode = await HsnCode.findById(req.params.id);
    if (!hsnCode) {
      return res.status(404).json({ error: 'HSN Code not found' });
    }
    res.json(hsnCode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createHsnCode = async (req, res) => {
  try {
    const { code, status } = req.body;
    const cleanCode = typeof code === 'string' ? code.trim().replace(/\s+/g, ' ') : '';

    if (!cleanCode) {
      return res.status(400).json({ error: 'HSN Code is required' });
    }

    const codeLower = normalizeKey(cleanCode);
    const existing = await HsnCode.findOne({ codeLower });
    if (existing) {
      return res.status(409).json({ error: `HSN Code "${cleanCode}" already exists` });
    }

    const hsnCode = new HsnCode({
      code: cleanCode,
      codeLower,
      status: status || 'Active'
    });

    await hsnCode.save();
    res.status(201).json(hsnCode);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'HSN Code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateHsnCode = async (req, res) => {
  try {
    const { code, status } = req.body;
    const hsnCode = await HsnCode.findById(req.params.id);
    if (!hsnCode) {
      return res.status(404).json({ error: 'HSN Code not found' });
    }

    if (code !== undefined) {
      const cleanCode = typeof code === 'string' ? code.trim().replace(/\s+/g, ' ') : '';
      if (!cleanCode) {
        return res.status(400).json({ error: 'HSN Code cannot be empty' });
      }
      const codeLower = normalizeKey(cleanCode);
      const existing = await HsnCode.findOne({ codeLower, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ error: `HSN Code "${cleanCode}" already exists` });
      }
      hsnCode.code = cleanCode;
      hsnCode.codeLower = codeLower;
    }

    if (status && ['Active', 'Inactive'].includes(status)) {
      hsnCode.status = status;
    }

    await hsnCode.save();
    res.json(hsnCode);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'HSN Code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteHsnCode = async (req, res) => {
  try {
    const deleted = await HsnCode.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'HSN Code not found' });
    }
    res.json({ message: 'HSN Code deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
