/**
 * Create an admin or reset an existing admin's password.
 *   npm run create-admin -- someone@masstech.mn 'a-strong-password' "Display Name"
 */
import { db, pool, runMigrations } from "../src/db/client.js";
import { admins } from "../src/db/schema.js";
import { hashPassword } from "../src/lib/auth.js";

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password || password.length < 10) {
    console.error("Usage: npm run create-admin -- <email> <password (min 10 chars)> [name]");
    process.exit(1);
  }
  await runMigrations();
  const passwordHash = await hashPassword(password);
  await db
    .insert(admins)
    .values({ email: email.toLowerCase(), passwordHash, name: name ?? null })
    .onConflictDoUpdate({ target: admins.email, set: { passwordHash, ...(name ? { name } : {}) } });
  console.log(`Admin ${email} saved.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
