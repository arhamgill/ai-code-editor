import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "var(--bg-primary)",
      backgroundImage: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)"
    }}>
      <SignIn appearance={{
        variables: {
          colorPrimary: "#6366f1",
          colorBackground: "#11131e",
          colorInputBackground: "#0a0b10",
          colorText: "#f3f4f6",
          colorTextSecondary: "#9ca3af",
          colorBorder: "rgba(255, 255, 255, 0.08)",
        }
      }} />
    </div>
  );
}
