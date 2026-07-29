import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { PolishAuthInputs } from "../../PolishAuthInputs";

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <Link href="/" className="auth-brand">
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          Forge
        </Link>
        <SignIn />
        <PolishAuthInputs />
      </div>
    </div>
  );
}
