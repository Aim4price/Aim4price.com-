import { headers } from "next/headers";
import { isAccountActive } from "./account-profile";
import { auth } from "./auth";

type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;

type SessionOptions = {
  requireActive?: boolean;
};

async function readAuthSession(): Promise<ServerSession> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getAnyServerSession(): Promise<ServerSession> {
  return readAuthSession();
}

export async function getServerSession(
  options: SessionOptions = {},
): Promise<ServerSession> {
  const session = await readAuthSession();

  if (!session?.user?.id) {
    return session;
  }

  if (options.requireActive === false) {
    return session;
  }

  return (await isAccountActive({
    id: session.user.id,
    email: session.user.email,
  }))
    ? session
    : null;
}
