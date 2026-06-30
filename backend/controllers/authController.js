const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { validateEmail, validateOtp } = require('../utils/validators');
const { sendOtpEmail } = require('../services/emailService');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helper ────────────────────────────────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { id: user._id || user.id, role: user.role },
    process.env.JWT_SECRET || 'medcare_jwt_secret_key_2026_xyz',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─── Mock DB (fallback when MongoDB not connected) ─────────────────────────────
let mockUsers = [
  {
    id: 'mock_admin_id_9999',
    _id: 'mock_admin_id_9999',
    name: 'Admin User',
    username: 'admin',
    email: 'admin@medcare.com',
    password: '$2a$12$dummyhash', // not used in mock - direct compare
    role: 'admin',
    isVerified: true,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin',
    phone: '9988776655',
    bloodGroup: 'AB+',
    allergies: ['Penicillin'],
    addresses: [],
    familyMembers: []
  }
];
let mockOtps = [];
global.mockUsersList = mockUsers;

// ─── STEP 1: Send OTP (only for signup) ───────────────────────────────────────
exports.sendOtp = async (req, res) => {
  const { email, name } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (global.isDbMock) {
      mockOtps = mockOtps.filter((o) => o.email !== normalizedEmail);
      mockOtps.push({ email: normalizedEmail, otp: otpCode, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
      console.log(`\n[MOCK OTP] email=${normalizedEmail} | CODE: ${otpCode}\n`);
      return res.status(200).json({ success: true, message: 'OTP sent (Mock Mode)', mockOtp: otpCode });
    }

    // Real DB flow
    const otpHash = await bcrypt.hash(otpCode, 12);
    await OTP.deleteMany({ email: normalizedEmail });
    await OTP.create({ email: normalizedEmail, otpHash, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });

    const delivery = await sendOtpEmail(normalizedEmail, otpCode, name || '');
    if (!delivery.success) {
      return res.status(200).json({ success: true, message: delivery.message, mockOtp: otpCode });
    }

    return res.status(200).json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('sendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
  }
};

// ─── STEP 2: Verify OTP + Complete Signup ─────────────────────────────────────
// Called with: { name, username, email, password, otp }
exports.register = async (req, res) => {
  const { name, username, email, password, otp } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;
  const normalizedUsername = username ? username.trim().toLowerCase() : undefined;

  if (!name || !normalizedUsername || !normalizedEmail || !password || !otp) {
    return res.status(400).json({ success: false, message: 'All fields are required: name, username, email, password, OTP.' });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }
  if (!validateOtp(otp)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 6-digit OTP.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    return res.status(400).json({ success: false, message: 'Username must be 3-20 characters (letters, numbers, underscore only).' });
  }

  try {
    if (global.isDbMock) {
      // Verify OTP
      const record = mockOtps.find((o) => o.email === normalizedEmail);
      if (!record || record.otp !== otp || record.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
      }
      // Check duplicates
      if (mockUsers.find((u) => u.email === normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }
      if (mockUsers.find((u) => u.username === normalizedUsername)) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = {
        id: 'mock_user_' + Date.now(),
        _id: 'mock_user_' + Date.now(),
        name,
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        role: mockUsers.length <= 1 ? 'admin' : 'user',
        isVerified: true,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalizedUsername}`,
        addresses: [],
        familyMembers: [],
        allergies: []
      };
      mockUsers.push(user);
      mockOtps = mockOtps.filter((o) => o.email !== normalizedEmail);
      const token = generateToken(user);
      const { password: _, ...safeUser } = user;
      return res.status(201).json({ success: true, token, user: safeUser });
    }

    // Real DB
    const record = await OTP.findOne({ email: normalizedEmail, used: false }).sort({ expiresAt: -1 });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }
    const isMatch = await bcrypt.compare(otp, record.otpHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    if (await User.findOne({ username: normalizedUsername })) {
      return res.status(400).json({ success: false, message: 'Username already taken.' });
    }

    record.used = true;
    await record.save();

    const hashedPassword = await bcrypt.hash(password, 12);
    const userCount = await User.countDocuments({});
    const user = await User.create({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: userCount === 0 ? 'admin' : 'user',
      isVerified: true,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalizedUsername}`
    });

    const token = generateToken(user);
    const { password: _, ...safeUser } = user.toObject();
    return res.status(201).json({ success: true, token, user: safeUser });
  } catch (error) {
    console.error('register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// ─── LOGIN (username/email + password) ────────────────────────────────────────
exports.login = async (req, res) => {
  const { identifier, password } = req.body; // identifier = username OR email
  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
  }

  const isEmail = identifier.includes('@');
  const normalizedIdentifier = identifier.trim().toLowerCase();

  try {
    if (global.isDbMock) {
      const user = mockUsers.find((u) =>
        isEmail ? u.email === normalizedIdentifier : u.username === normalizedIdentifier
      );
      if (!user || !user.password) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const token = generateToken(user);
      const { password: _, ...safeUser } = user;
      return res.status(200).json({ success: true, token, user: safeUser });
    }

    const query = isEmail ? { email: normalizedIdentifier } : { username: normalizedIdentifier };
    const user = await User.findOne(query).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    if (!user.isVerified) {
      return res.status(401).json({ success: false, message: 'Account not verified. Please complete signup.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    const { password: _, ...safeUser } = user.toObject();
    return res.status(200).json({ success: true, token, user: safeUser });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ─── GOOGLE OAuth Login/Signup ─────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  const { credential, email: mockEmail, name: mockName, avatar: mockAvatar } = req.body;

  try {
    let email = mockEmail || 'googleuser@medcare.com';
    let name = mockName || 'Google User';
    let avatar = mockAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=Google`;
    let googleId = 'mock_google_id_' + Date.now();

    if (!global.isDbMock && credential) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        avatar = payload.picture;
        googleId = payload.sub;
      } catch (err) {
        console.error('Google token verification failed:', err.message);
        return res.status(401).json({ success: false, message: 'Google authentication failed.' });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (global.isDbMock) {
      let user = mockUsers.find((u) => u.email === normalizedEmail);
      if (!user) {
        const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
        user = {
          id: 'mock_google_' + Date.now(),
          _id: 'mock_google_' + Date.now(),
          name,
          username: baseUsername + '_' + Date.now().toString().slice(-4),
          email: normalizedEmail,
          googleId,
          avatar,
          role: mockUsers.length <= 1 ? 'admin' : 'user',
          isVerified: true,
          addresses: [],
          familyMembers: [],
          allergies: []
        };
        mockUsers.push(user);
      }
      const token = generateToken(user);
      return res.status(200).json({ success: true, token, user });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: normalizedEmail }] });
    if (!user) {
      const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
      const uniqueUsername = baseUsername + '_' + Date.now().toString().slice(-4);
      const userCount = await User.countDocuments({});
      user = await User.create({
        name,
        username: uniqueUsername,
        email: normalizedEmail,
        googleId,
        avatar,
        role: userCount === 0 ? 'admin' : 'user',
        isVerified: true
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const token = generateToken(user);
    const { password: _, ...safeUser } = user.toObject ? user.toObject() : user;
    return res.status(200).json({ success: true, token, user: safeUser });
  } catch (error) {
    console.error('googleLogin error:', error);
    return res.status(500).json({ success: false, message: 'Google auth failed.' });
  }
};

// ─── GET ME ────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    if (global.isDbMock) {
      const user = mockUsers.find((u) => u.id === req.user.id || u._id === req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const { password: _, ...safeUser } = user;
      return res.status(200).json({ success: true, user: safeUser });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { password: _, ...safeUser } = user.toObject();
    return res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
};

// ─── Keep verifyOtp for backward compat (not used in new flow) ─────────────────
exports.verifyOtp = exports.register;
