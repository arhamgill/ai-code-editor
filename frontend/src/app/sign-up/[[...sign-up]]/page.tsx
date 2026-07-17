import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "var(--bg-primary)",
      backgroundImage: "radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 60%)"
    }}>
      <SignUp appearance={{
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
