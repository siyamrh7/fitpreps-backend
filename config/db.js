const { MongoClient, ServerApiVersion } = require('mongodb');

let db;

const connectDB = async () => {
  try {
    const client = new MongoClient("mongodb+srv://siyam:siyam@fitpreps.q2yky.mongodb.net/?retryWrites=true&w=majority&appName=fitpreps", {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      },
      autoSelectFamily: false
    });
    await client.connect();

    // Assign the database to `db`
    db = client.db('fitpreps'); // Replace 'fitpreps' with your database name
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    console.error('Database not initialized!');
    throw new Error('Database connection not established. Did you forget to call connectDB()?');
  }
  return db;
};
module.exports = { connectDB, getDB };
