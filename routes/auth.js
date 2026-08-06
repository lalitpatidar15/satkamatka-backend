const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {error: 'Too many attempts, please try again after 15 minutes'},
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {error: 'Too many accounts created, please try again later'},
  standardHeaders: true,
  legacyHeaders: false,
});

const validatePhone = (phone) => /^\d{10}$/.test(phone);
const validatePassword = (pwd) => pwd && pwd.length >= 6;
const validateMpin = (mpin) => /^\d{4}$/.test(mpin);

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const {name, phone, password, mpin} = req.body;

    if (!name?.trim()) {
      return res.status(400).json({error: 'Name is required'});
    }
    if (!validatePhone(phone)) {
      return res.status(400).json({error: 'Phone must be 10 digits'});
    }
    if (!validatePassword(password)) {
      return res.status(400).json({error: 'Password must be at least 6 characters'});
    }
    if (mpin && !validateMpin(mpin)) {
      return res.status(400).json({error: 'MPIN must be 4 digits'});
    }

    let user = await User.findOne({phone});
    if (user) {
      return res.status(400).json({error: 'User already exists'});
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedMpin = mpin ? await User.hashMpin(mpin) : null;

    user = new User({
      name: name.trim(),
      phone,
      password: hashedPassword,
      mpin: hashedMpin,
      wallet: 0,
    });

    await user.save();

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(201).json({token, user: {id: user._id, name: name.trim(), phone}});
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const {phone, password} = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({error: 'Invalid phone number'});
    }
    if (!password) {
      return res.status(400).json({error: 'Password is required'});
    }

    const user = await User.findOne({phone});
    if (!user) {
      return res.status(400).json({error: 'Invalid credentials'});
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({error: 'Invalid credentials'});
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({token, user: {id: user._id, name: user.name, phone}});
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/verify-mpin', authLimiter, async (req, res) => {
  try {
    const {phone, mpin} = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({error: 'Invalid phone number'});
    }
    if (!validateMpin(mpin)) {
      return res.status(400).json({error: 'MPIN must be 4 digits'});
    }

    const user = await User.findOne({phone});
    if (!user || !user.mpin) {
      return res.status(400).json({error: 'Invalid MPIN'});
    }

    const isMatch = await user.compareMpin(mpin);
    if (!isMatch) {
      return res.status(400).json({error: 'Invalid MPIN'});
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({token, user: {id: user._id, name: user.name, phone: user.phone}});
  } catch (error) {
    console.error('MPIN verify error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -mpin');
    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

module.exports = router;
