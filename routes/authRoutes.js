const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/databaseModels');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, platform } = req.body;
    
    const existingUser = await User.findOne({ 
      $and: [
        { $or: [{ email }, { username }] },
        { platform }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists on this platform' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      fullName,
      platform
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, platform: user.platform },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        platform: user.platform
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password, platform } = req.body;

    const user = await User.findOne({
      $and: [
        { $or: [{ email: identifier }, { username: identifier }] },
        { platform: platform }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials or platform' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, platform: user.platform },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        platform: user.platform
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;