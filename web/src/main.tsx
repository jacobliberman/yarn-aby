import { StrictMode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./App.tsx";

const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

function Root() {
  if (!clerkPk) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: "48rem" }}>
        <h1>Stitch &amp; Stock</h1>
        <p>Add VITE_CLERK_PUBLISHABLE_KEY to your .env (see .env.example).</p>
      </main>
    );
  }
  return (
    <ClerkProvider publishableKey={clerkPk} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
