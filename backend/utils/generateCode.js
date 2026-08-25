const Counter = require('../models/Counter');

const pad = (num, size) => String(num).padStart(size, '0');

const nextSequence = async (key, prefix, session, size = 5) => {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `${prefix}-${pad(counter.seq, size)}`;
};

const currentYearPrefix = (prefix) => `${prefix}-${new Date().getFullYear()}`;

module.exports = { nextSequence, currentYearPrefix };
