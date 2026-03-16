import {
  GripVertical,
  Download,
  Zap,
  Server,
  Users,
  Undo2,
  ArrowRight,
  Github,
  MessageSquare,
  ChevronRight,
} from "lucide-react"

const FEATURES = [
  {
    icon: GripVertical,
    title: "Drag & Drop",
    desc: "Pick from 3,000+ real device types and drag them into your rack. Snap-to-U alignment handles positioning automatically.",
  },
  {
    icon: Download,
    title: "Export Anywhere",
    desc: "Export to SVG, PDF, or Visio (.vsdx) in one click. Vector quality, print-ready, compatible with your existing workflows.",
  },
  {
    icon: Zap,
    title: "Power & Weight Tracking",
    desc: "Real-time capacity stats with warnings for power, weight, and airflow thresholds. No more spreadsheets.",
  },
  {
    icon: Server,
    title: "3,000+ Devices",
    desc: "Comprehensive library of real-world server, network, and storage hardware. Add custom device types in seconds.",
  },
  {
    icon: Users,
    title: "Share & Collaborate",
    desc: "Share rack designs via link. Your team can view and fork layouts without signing up.",
  },
  {
    icon: Undo2,
    title: "Undo / Redo",
    desc: "Full undo/redo history. Experiment freely — every change is reversible with a single keystroke.",
  },
]

const STEPS = [
  {
    num: "1",
    title: "Design",
    desc: "Search the device catalog or add custom types. Drag them into your rack with snap-to-U precision.",
  },
  {
    num: "2",
    title: "Validate",
    desc: "Real-time power, weight, and airflow calculations catch problems before they reach the floor.",
  },
  {
    num: "3",
    title: "Export & Share",
    desc: "Download as SVG, PDF, or Visio. Share a link so your team can view or fork the layout.",
  },
]

function HeroRackIllustration() {
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0" aria-hidden="true">
      {/* Glow background */}
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75" />
      {/* Rack SVG */}
      <svg
        viewBox="0 0 200 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-auto drop-shadow-2xl"
      >
        {/* Rack frame */}
        <rect x="30" y="10" width="140" height="300" rx="6" fill="#131a2b" stroke="#1e293b" strokeWidth="1.5" />
        {/* Rack rails */}
        <rect x="38" y="10" width="4" height="300" rx="1" fill="#1e293b" />
        <rect x="158" y="10" width="4" height="300" rx="1" fill="#1e293b" />

        {/* Server units */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => {
          const y = 18 + i * 22
          const isHighlighted = i === 2 || i === 5 || i === 8
          const isActive = i === 0 || i === 3 || i === 6 || i === 10
          return (
            <g key={i}>
              <rect
                x="46"
                y={y}
                width="108"
                height="18"
                rx="3"
                fill={isHighlighted ? "#1a2744" : "#0f1422"}
                stroke={isHighlighted ? "#4f7df5" : "#1e293b"}
                strokeWidth={isHighlighted ? "1" : "0.5"}
              />
              {/* LED indicators */}
              <circle cx="54" cy={y + 9} r="2" fill={isActive ? "#4ade80" : "#334155"} />
              <circle cx="62" cy={y + 9} r="2" fill={isHighlighted ? "#4f7df5" : "#334155"} />
              {/* Drive bays */}
              {[0, 1, 2, 3].map((j) => (
                <rect
                  key={j}
                  x={80 + j * 18}
                  y={y + 4}
                  width="14"
                  height="10"
                  rx="1.5"
                  fill={isHighlighted ? "#1e3a5f" : "#0a0e1a"}
                  stroke="#1e293b"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight">rackifai</span>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/JosephMcEvoy/rackifai"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="#/editor"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Open Editor
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-24 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Open source &middot; Free to use
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Plan your datacenter racks{" "}
              <span className="text-primary relative">
                visually
                <span className="absolute -inset-1 bg-primary/10 blur-2xl rounded-full -z-10" />
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
              Drag-and-drop rack planner with 3,000+ real device types, power tracking,
              and one-click export to SVG, PDF, or Visio.
            </p>
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <a
                href="#/editor"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Try it free
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/JosephMcEvoy/rackifai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>
          <div className="hidden lg:block">
            <HeroRackIllustration />
          </div>
        </div>
      </section>

      {/* Features — Bento Grid */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need to plan racks
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Powerful features designed for modern IT infrastructure teams.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group relative rounded-xl border border-border bg-card/50 p-6 hover:border-primary/30 hover:bg-card/80 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg">
            Three simple steps to perfectly planned racks.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden sm:block absolute top-[2.25rem] left-[calc(16.67%+1.25rem)] right-[calc(16.67%+1.25rem)] h-px bg-border"
            aria-hidden="true"
          />
          {STEPS.map((s) => (
            <div key={s.num} className="relative text-center">
              <div className="w-[3.5rem] h-[3.5rem] rounded-full bg-primary/10 border-2 border-primary/30 text-primary font-bold text-lg flex items-center justify-center mx-auto mb-4 relative z-10 bg-background">
                {s.num}
              </div>
              <h3 className="text-base font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/50 via-primary/20 to-primary/50 p-px">
            <div className="w-full h-full rounded-2xl bg-background" />
          </div>
          <div className="relative p-10 sm:p-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Ready to plan your rack?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              No sign-up required. Open the editor and start building in seconds.
            </p>
            <a
              href="#/editor"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Start planning for free
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium">rackifai</span>
          <span className="text-xs">Open source datacenter rack planner</span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/JosephMcEvoy/rackifai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
            <a
              href="https://github.com/JosephMcEvoy/rackifai/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
