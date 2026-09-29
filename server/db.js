// db.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables");
}

if (!DB_NAME) {
  throw new Error("DB_NAME is not defined in environment variables");
}

let db;

export async function connectDB() {
  if (db) return db;

  const client = new MongoClient(MONGO_URI);
  await client.connect();

  db = client.db(DB_NAME);
  console.log("MongoDB connected");

  return db;
}

export function getDB() {
  if (!db) {
    throw new Error("DB not connected yet");
  }
  return db;
}