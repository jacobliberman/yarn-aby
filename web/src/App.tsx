import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";

import { Patterns } from "./pages/Patterns.tsx";
import { Projects } from "./pages/Projects.tsx";
import { Yarn } from "./pages/Yarn.tsx";

export default function App() {
  return (
    <>
      <SignedOut>
        <main
          style={{
            padding: "1.5rem",
            maxWidth: "26rem",
            margin: "0 auto",
          }}
        >
          <h1 style={{ textAlign: "center" }}>Stitch &amp; Stock</h1>
          <SignIn />
        </main>
      </SignedOut>
      <SignedIn>
        <main style={{ padding: "1.5rem", maxWidth: "48rem" }}>
          <header
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "1rem",
            }}
          >
            <UserButton />
          </header>
          <h1>Stitch &amp; Stock</h1>
          <Yarn />
          <Patterns />
          <Projects />
        </main>
      </SignedIn>
    </>
  );
}
