import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in environment. Aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const mapping = {
  '0983171982': 'minhd.mbb@gmail.com',
  '1505': 'benpoddle@gmail.com',
  '1403': 'bicorgi@gmail.com',
  '0922076868': 'giang.mbbank@gmail.com',
};

function generatePassword() {
  return crypto.randomBytes(10).toString('base64').slice(0, 16);
}

console.log('Starting Supabase user sync for', Object.keys(mapping).length, 'users');

for (const [username, email] of Object.entries(mapping)) {
  console.log('\n-- processing', username, '->', email);

  try {
    const dbUser = await prisma.user.findUnique({ where: { username } });

    if (!dbUser) {
      console.warn('No prisma.user found for username', username, '- skipping');
      continue;
    }

    if (dbUser.email && dbUser.email.toLowerCase() === email.toLowerCase()) {
      console.log('Prisma email already set for', username, '-', email);
    } else {
      await prisma.user.update({ where: { id: dbUser.id }, data: { email } });
      console.log('Updated prisma.user.email for', username, '->', email);
    }

    // attempt to create Supabase user
    const password = generatePassword();

    try {
      const res = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (res.error) {
        throw res.error;
      }

      console.log('Created Supabase user for', email, 'id=', res.data.user?.id ?? '(no id)');
      console.log('Temporary password:', password);
    } catch (err) {
      console.warn('Create user error:', err && err.message ? err.message : err);
      // try to find existing user by listing users and matching email
      try {
        const list = await supabase.auth.admin.listUsers();
        const found = (list.data?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          console.log('Supabase user already exists for', email, 'id=', found.id);
        } else {
          console.warn('Could not find existing Supabase user for', email);
        }
      } catch (listErr) {
        console.warn('Error listing users:', listErr && listErr.message ? listErr.message : listErr);
      }
    }
  } catch (e) {
    console.error('Unexpected error processing', username, e);
  }
}

await prisma.$disconnect();
console.log('\nDone.');
