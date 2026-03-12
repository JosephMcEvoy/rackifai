import { useState } from "react"

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    setStatus("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), email: email.trim() || undefined }),
      })
      if (!res.ok) throw new Error("Failed")
      setStatus("sent")
      setMessage("")
      setEmail("")
      setTimeout(() => {
        setStatus("idle")
        setOpen(false)
      }, 2000)
    } catch {
      setStatus("error")
    }
  }

  return (
    <>
      {/* Tab button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 rotate-180 px-2 py-3 text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-b-md hover:bg-zinc-700 transition-colors"
          style={{ writingMode: "vertical-rl" }}
        >
          Feedback
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100">Send Feedback</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 text-lg leading-none"
            >
              &times;
            </button>
          </div>

          {status === "sent" ? (
            <p className="text-sm text-emerald-400">Thanks for your feedback!</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                required
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {status === "error" && (
                <p className="text-xs text-red-400">Something went wrong. Try again.</p>
              )}
              <button
                type="submit"
                disabled={status === "sending" || !message.trim()}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === "sending" ? "Sending..." : "Submit"}
              </button>
              <a
                href="https://github.com/JosephMcEvoy/rackifai/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Report a bug on GitHub
              </a>
            </form>
          )}
        </div>
      )}
    </>
  )
}
