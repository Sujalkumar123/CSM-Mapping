import mongoose from 'mongoose';

// Shared across whatsapp.js (auth session) and clientsStore.js (CSM
// directory) — mongoose keeps one underlying connection per process
// regardless of how many modules import it, this just makes the connect
// call idempotent and gives both callers the same success/failure signal.
let connectingPromise = null;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  if (mongoose.connection.readyState === 1) return true;
  if (!connectingPromise) {
    connectingPromise = mongoose.connect(uri)
      .then(() => true)
      .catch(err => {
        connectingPromise = null;
        throw err;
      });
  }
  return connectingPromise;
}
