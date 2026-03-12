import { describe, it, expect, beforeEach } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { writeWal, clearWal, replayWal } from "./project-wal"
import { saveLocalProject, loadLocalProject, __resetDB } from "./local-db"
import type { LocalProject } from "@/types/project"

function makeProject(overrides: Partial<LocalProject> = {}): LocalProject {
  return {
    id: "test-project-id",
    name: "Test",
    storageMode: "local",
    configJson: { racks: { r1: { id: "r1" } }, devices: {} },
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  __resetDB()
  globalThis.indexedDB = new IDBFactory()
})

describe("WAL write/clear", () => {
  it("writes a WAL entry to localStorage", () => {
    writeWal("proj-1", "My Project", { racks: {}, devices: {} })

    const raw = localStorage.getItem("rackifai-wal-proj-1")
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw!)
    expect(parsed.id).toBe("proj-1")
    expect(parsed.name).toBe("My Project")
    expect(parsed.timestamp).toBeTypeOf("number")
  })

  it("clears WAL entry", () => {
    writeWal("proj-1", "Test", { racks: {}, devices: {} })
    clearWal("proj-1")

    expect(localStorage.getItem("rackifai-wal-proj-1")).toBeNull()
  })

  it("uses per-project keys (no collision)", () => {
    writeWal("proj-1", "A", { racks: {}, devices: {} })
    writeWal("proj-2", "B", { racks: {}, devices: {} })

    expect(localStorage.getItem("rackifai-wal-proj-1")).toBeTruthy()
    expect(localStorage.getItem("rackifai-wal-proj-2")).toBeTruthy()
  })
})

describe("WAL replay", () => {
  it("replays WAL into IndexedDB when no existing project", async () => {
    writeWal("wal-test", "WAL Project", {
      racks: { r1: { id: "r1" } },
      devices: {},
    })

    const replayed = await replayWal("wal-test")
    expect(replayed).toBe(true)

    const loaded = await loadLocalProject("wal-test")
    expect(loaded).toBeDefined()
    expect(loaded!.name).toBe("WAL Project")

    // WAL should be cleared after replay
    expect(localStorage.getItem("rackifai-wal-wal-test")).toBeNull()
  })

  it("skips replay if IndexedDB is newer", async () => {
    // Save a project with a recent timestamp
    const project = makeProject({
      id: "wal-skip",
      updatedAt: new Date(Date.now() + 60000).toISOString(), // 1 minute in the future
    })
    await saveLocalProject(project)

    // Write a WAL with current timestamp (older than project)
    writeWal("wal-skip", "Stale WAL", { racks: {}, devices: {} })

    const replayed = await replayWal("wal-skip")
    expect(replayed).toBe(false)

    // Original data should be preserved
    const loaded = await loadLocalProject("wal-skip")
    expect(loaded!.name).toBe("Test")
  })

  it("returns false when no WAL entry exists", async () => {
    const replayed = await replayWal("no-wal")
    expect(replayed).toBe(false)
  })
})
