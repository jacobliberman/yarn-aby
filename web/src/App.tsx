import { Patterns } from "./pages/Patterns.tsx";
import { Projects } from "./pages/Projects.tsx";
import { Yarn } from "./pages/Yarn.tsx";

export default function App() {
  return (
    <main style={{ padding: "1.5rem", maxWidth: "48rem" }}>
      <h1>Stitch &amp; Stock</h1>
      <Yarn />
      <Patterns />
      <Projects />
    </main>
  );
}
