const FEATURES = [
  {
    title: "Drag & Drop",
    desc: "Pick from 3,000+ real device types and drag them into your rack. Snap-to-U alignment handles positioning automatically.",
  },
  {
    title: "Export Anywhere",
    desc: "Export to SVG, PDF, or Visio (.vsdx) in one click. Vector quality, print-ready, compatible with your existing workflows.",
  },
  {
    title: "Power & Weight Tracking",
    desc: "Real-time capacity stats with warnings for power, weight, and airflow thresholds. No more spreadsheets.",
  },
]

const STEPS = [
  { num: "1", title: "Pick devices", desc: "Search the catalog or add custom device types" },
  { num: "2", title: "Configure rack", desc: "Drag devices into position with snap-to-U alignment" },
  { num: "3", title: "Export & share", desc: "Download as SVG, PDF, or Visio — or share a link" },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-lg font-bold tracking-tight">rackifai</span>
        <a
          href="#/editor"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open Editor
        </a>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
          Plan your datacenter racks
          <br />
          <span className="text-primary">visually.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Drag-and-drop rack planner with real device types, power tracking,
          and one-click export to SVG, PDF, or Visio.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="#/editor"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try it free
          </a>
<a
            href="https://github.com/JosephMcEvoy/rackifai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

{/* Features */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">
          Everything you need to plan racks
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {s.num}
              </div>
              <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 max-w-3xl mx-auto text-center">
        <div className="rounded-lg border border-border bg-card p-10">
          <h2 className="text-xl font-bold mb-2">Ready to plan your rack?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            No sign-up required. Start building in seconds.
          </p>
          <a
            href="#/editor"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open the editor
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>rackifai — Open source rack planner</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/JosephMcEvoy/rackifai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/JosephMcEvoy/rackifai/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Feedback
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
