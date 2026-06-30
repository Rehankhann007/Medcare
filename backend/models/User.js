const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
});

const familyMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relation: { type: String, required: true },
  age: { type: Number, required: true }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // hashed password (null for Google-only users)
  phone: { type: String },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false }, // true after OTP verified at signup
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  bloodGroup: { type: String },
  allergies: [{ type: String }],
  avatar: { type: String },
  addresses: [addressSchema],
  familyMembers: [familyMemberSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
