const mongoose = require('mongoose');

/**
 * Middleware to validate Mongoose ObjectId in request parameters.
 * Checks req.params.id (or a specified parameter) and returns 400 Bad Request
 * if the parameter is not a valid ObjectId, preventing cast errors / server crashes.
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params ? req.params[paramName] : null;
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Invalid ID: ${id}` });
    }
    next();
  };
};

const validateObjectIdMiddleware = (req, res, next) => {
  if (typeof req === 'string') {
    return validateObjectId(req);
  }

  const id = req.params?.id;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: `Invalid ID: ${id}` });
  }
  next();
};

module.exports = validateObjectIdMiddleware;
module.exports.validateObjectId = validateObjectId;
