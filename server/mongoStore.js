import { MongoClient } from 'mongodb';
import { isDeepStrictEqual } from 'node:util';
import { validateStore } from './dataStore.js';

const transactionOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
const conflict = () => Object.assign(new Error('Data changed. Refresh and try again.'), { status: 409 });

// Store gallery images individually so thirty uploaded images cannot exceed
// MongoDB's per-document size limit. Other records retain the existing API keys.
function documents(value) {
  const entries = Object.entries(value).filter(([key]) => key !== 'gallery').map(([key, value]) => [`data:${key}`, value]);
  if (value.gallery) {
    entries.push(['data:gallery', value.gallery.map(item => item.id)]);
    for (const item of value.gallery) entries.push([`image:${item.id}`, item]);
  }
  return new Map(entries);
}

export async function openMongoStore({ uri, database = 'barbershop' }) {
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Set a valid backend MONGODB_URI.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(database);
    const hello = await db.command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB requires a replica set (MongoDB Atlas is supported).');
    const records = db.collection('site_records');
    // Create outside transactions for compatibility with first startup.
    await records.createIndex({ kind: 1 });
    async function transaction(work) {
      const session = client.startSession();
      try { return await session.withTransaction(() => work(session), transactionOptions); }
      finally { await session.endSession(); }
    }
    return {
      async initialize(value, credential = null, { importOnly = false } = {}) {
        validateStore(value);
        await transaction(async session => {
          const existing = await records.findOne({ _id: 'meta' }, { session });
          if (existing) {
            if (importOnly) throw new Error('MongoDB already contains site data. Import refused; no data was overwritten.');
            return;
          }
          if (await records.countDocuments({}, { session })) throw new Error('Target collection is not empty. Use an empty database.');
          await records.insertMany([
            { _id: 'meta', revision: 0, kind: 'meta' },
            { _id: 'admin', value: credential, revision: 0, kind: 'admin' },
            ...Array.from(documents(value), ([_id, value]) => ({ _id, value, kind: 'data' })),
          ], { session });
        });
      },
      async read() {
        return transaction(async session => {
          const rows = await records.find({}, { session }).toArray();
          const byId = new Map(rows.map(row => [row._id, row]));
          const meta = byId.get('meta');
          if (!meta) throw new Error('MongoDB site data has not been initialized.');
          const value = Object.fromEntries(rows.filter(row => row._id.startsWith('data:')).map(row => [row._id.slice(5), row.value]));
          if (value.gallery) value.gallery = value.gallery.map(id => {
            const item = byId.get(`image:${id}`)?.value;
            if (!item) throw new Error('Gallery image record is missing.');
            return item;
          });
          return { value: validateStore(value), credential: byId.get('admin')?.value ?? null, credentialRevision: byId.get('admin')?.revision ?? 0, revision: meta.revision };
        });
      },
      async persist(next, snapshot) {
        const before = documents(snapshot.value), after = documents(next);
        await transaction(async session => {
          const result = await records.updateOne({ _id: 'meta', revision: snapshot.revision }, { $inc: { revision: 1 } }, { session });
          if (result.matchedCount !== 1) throw conflict();
          for (const [_id, value] of after) {
            if (!isDeepStrictEqual(before.get(_id), value)) await records.replaceOne({ _id }, { _id, value, kind: 'data' }, { upsert: true, session });
          }
          for (const _id of before.keys()) if (!after.has(_id)) await records.deleteOne({ _id }, { session });
        });
      },
      async saveCredential(next, expected) {
        const filter = expected ? { _id: 'admin', 'value.hash': expected.hash, 'value.salt': expected.salt } : { _id: 'admin', value: null };
        const result = await records.updateOne(filter, { $set: { value: next }, $inc: { revision: 1 } }, { writeConcern: { w: 'majority' } });
        if (result.matchedCount !== 1) throw conflict();
      },
      async checkHealth() { try { await db.command({ ping: 1 }); return true; } catch { return false; } },
      close: () => client.close(),
    };
  } catch (error) {
    await client.close();
    // Driver errors may contain connection details; don't expose credentials.
    if (error.message.startsWith('MongoDB requires')) throw error;
    throw new Error('MongoDB connection failed. Check MONGODB_URI, database permissions and network access.');
  }
}
