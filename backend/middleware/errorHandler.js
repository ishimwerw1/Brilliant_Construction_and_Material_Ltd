const mongoose = require('mongoose');

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors;

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier format.';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = errors[0] || 'Validation failed.';
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
  } else if (err.name === 'MongoServerError' && err.message.includes('duplicate key')) {
    statusCode = 409;
    message = 'Duplicate record detected.';
  } else if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError' ||
    (typeof err.message === 'string' &&
      (err.message.includes('tlsv1 alert') || err.message.includes('buffering timed out')))
  ) {
    statusCode = 503;
    message =
      'Cannot reach the cloud database. Check your internet connection. ' +
      'If this persists, the server IP may need to be allowed in MongoDB Atlas (Network Access).';
  }

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
    message = process.env.NODE_ENV === 'production' ? 'Internal server error' : message;
  }

  res.status(statusCode).json({ success: false, message, errors });
};

const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, wrapAsync };
