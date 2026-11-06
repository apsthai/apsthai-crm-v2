import Image from "next/image";
import { LoginForm } from "./login-form";

const MESSAGES: Record<string, string> = {
  inactive: "This account is not active. Please contact Admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200 sm:px-8">
          <Image src="/logo.png" alt="APSthai" width={848} height={342} priority className="mx-auto h-auto w-44" />
          <h1 className="mt-6 text-center text-lg font-semibold text-slate-900">Sign in to APSthai CRM</h1>
          <LoginForm notice={msg ? MESSAGES[msg] : undefined} />
        </div>
      </div>
    </main>
  );
}
