const mongoose = require('mongoose');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const isValidObjectId = (id) => {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);
};

/**
 * Middleware to validate Mongoose ObjectId in request parameters.
 * Checks req.params.id (or a specified parameter) and returns 400 Bad Request
 * if the parameter is not a valid ObjectId, preventing cast errors / server crashes.
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params ? req.params[paramName] : null;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ message: `Invalid ID: ${typeof id === 'string' ? id : 'malformed'}` });
    }
    next();
  };
};

const validateObjectIdMiddleware = (req, res, next) => {
  if (typeof req === 'string') {
    return validateObjectId(req);
  }

  const id = req.params?.id;
  if (!id || !isValidObjectId(id)) {
    return res.status(400).json({ message: `Invalid ID: ${typeof id === 'string' ? id : 'malformed'}` });
  }
  next();
};

module.exports = validateObjectIdMiddleware;
module.exports.validateObjectId = validateObjectId;
module.exports.isValidObjectId = isValidObjectId;
