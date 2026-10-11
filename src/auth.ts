import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { normalizeEmail, passwordLoginAllowed } from "@/lib/admin-access";
import { clientAddress } from "@/lib/client-address";
import { sessionStale } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindow, LOGIN_LIMIT, LOGIN_WINDOW_MS, loginSubject } from "@/lib/rate-limit";

class LoginLimited extends CredentialsSignin {
  code = "rate_limited";
}

class AccountSuspended extends CredentialsSignin {
  code = "suspended";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (!passwordLoginAllowed(email, process.env)) return null;

        const gate = await consumeFixedWindow({
          action: "login",
          subject: loginSubject(await clientAddress(), email),
          limit: LOGIN_LIMIT,
          windowMs: LOGIN_WINDOW_MS,
        });
        if (gate.limited) throw new LoginLimited();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        if (user.suspended) throw new AccountSuspended();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.role = user.role ?? "user";
        token.pwdAt = typeof user.passwordChangedAt === "number" ? user.passwordChangedAt : 0;
        return token;
      }
      const id = typeof token.id === "string" ? token.id : "";
      if (!id) return token;
      try {
        const row = await prisma.user.findUnique({
          where: { id },
          select: { passwordChangedAt: true, suspended: true },
        });
        if (!row || row.suspended) return null;
        const stamped = typeof token.pwdAt === "number" ? token.pwdAt : 0;
        if (sessionStale(stamped, row.passwordChangedAt)) return null;
      } catch (error) {
        console.error("Could not check whether this session is still valid.", error);
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = typeof token.id === "string" ? token.id : "";
      session.user.role = typeof token.role === "string" ? token.role : "user";
      return session;
    },
  },
});
