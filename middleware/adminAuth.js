const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({error: 'No token, authorization denied'});
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isAdmin) {
      return res.status(403).json({error: 'Admin access required'});
    }

    req.user = decoded;
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(401).json({error: 'Token is not valid'});
  }
};
