import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <AuthScreen mode="signin" />
    </Suspense>
  );
}
