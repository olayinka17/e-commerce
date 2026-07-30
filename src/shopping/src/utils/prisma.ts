import fs from 'fs'
import path from 'path'
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";


function getSecret(secretName: string) {
  try {
    // Docker mounts secrets to /run/secrets/ by default
    const secretPath = path.join('/run/secrets', secretName);
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    // Fallback to environment variables for local development flexibility
    return process.env[secretName]; 
  }
}



const connectionString = getSecret("SHOPPING_DATABASE_URL") as string

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
