import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthScreen mode="signup" />
    </Suspense>
  );
}
