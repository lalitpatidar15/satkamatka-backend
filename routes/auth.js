const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const {name, phone, password, mpin} = req.body;

    let user = await User.findOne({phone});
    if (user) {
      return res.status(400).json({error: 'User already exists'});
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      phone,
      password: hashedPassword,
      mpin,
      wallet: 0,
    });

    await user.save();

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET || 'matka_secret', {
      expiresIn: '30d',
    });

    res.status(201).json({token, user: {id: user._id, name, phone}});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const {phone, password} = req.body;

    const user = await User.findOne({phone});
    if (!user) {
      return res.status(400).json({error: 'Invalid credentials'});
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({error: 'Invalid credentials'});
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET || 'matka_secret', {
      expiresIn: '30d',
    });

    res.json({token, user: {id: user._id, name: user.name, phone}});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Verify MPIN
router.post('/verify-mpin', async (req, res) => {
  try {
    const {phone, mpin} = req.body;

    const user = await User.findOne({phone});
    if (!user || user.mpin !== mpin) {
      return res.status(400).json({error: 'Invalid MPIN'});
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET || 'matka_secret', {
      expiresIn: '30d',
    });

    res.json({token, user: {id: user._id, name: user.name, phone: user.phone}});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get profile
router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
