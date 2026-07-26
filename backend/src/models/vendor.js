const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  performanceScore: { type: Number, default: 100 }, // 0-100
  qualityRating: { type: Number, default: 5 }, // 1-5
  itemCategories: {
    type: [String],
    default: []
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  gstType: {
    type: String,
    enum: ['Regular', 'Composition', 'Unregistered', 'Consumer'],
    default: 'Regular'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);
