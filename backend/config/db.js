const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log(`MongoDB Atlas connected: ${mongoose.connection.host}`);
  } catch (err) {
    if (typeof err.message === 'string' && err.message.includes('tlsv1 alert')) {
      console.error(
        '\n[MONGO TLS ERROR] MongoDB Atlas rejected the connection (SSL alert).\n' +
        'Most likely cause: this network\'s public IP is not whitelisted.\n' +
        'Fix: open https://cloud.mongodb.com -> your project -> Network Access ->\n' +
        'ADD IP ADDRESS -> add your current IP (or choose "Allow Access From Anywhere" / 0.0.0.0/0), then restart this server.\n'
      );
    }
    throw err;
  }
  mongoose.connection.on('error', (e) => console.error('[MongoDB runtime error]', e.message || e));
};

module.exports = { connectDB };
