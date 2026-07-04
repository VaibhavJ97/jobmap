import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSql, ensureSchema } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        await ensureSchema();
        const sql = getSql();
        if (!sql) return null;

        const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
        const user = rows[0];
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password_hash as string);
        if (!ok) return null;

        return { id: String(user.id), email: user.email as string };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
});
