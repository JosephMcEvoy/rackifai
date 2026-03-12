import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useRackStore,
  RACK_STATUSES,
  RACK_AIRFLOWS,
  RACK_FORM_FACTORS,
  RACK_WIDTHS,
  DIMENSION_UNITS,
  WEIGHT_UNITS,
  type RackState,
  type RackStatus,
  type RackAirflow,
  type RackFormFactor,
  type DimensionUnit,
  type WeightUnit,
} from "@/store/rack-store"
import { RACK_SIZES } from "@/canvas/rack"
import { RackTypePicker } from "@/components/rack-type-picker"

interface RackPropertiesPanelProps {
  rackId: string
}

// --- Display labels ---

const STATUS_LABELS: Record<RackStatus, string> = {
  active: "Active",
  planned: "Planned",
  reserved: "Reserved",
  available: "Available",
  deprecated: "Deprecated",
}

const AIRFLOW_LABELS: Record<RackAirflow, string> = {
  "front-to-rear": "Front to rear",
  "rear-to-front": "Rear to front",
}

const FORM_FACTOR_LABELS: Record<RackFormFactor, string> = {
  "2-post-frame": "2-post frame",
  "4-post-cabinet": "4-post cabinet",
  "4-post-frame": "4-post frame",
  "wall-mount-frame": "Wall-mounted frame",
  "wall-mount-frame-vertical": "Wall-mounted frame (vertical)",
  "wall-mount-cabinet": "Wall-mounted cabinet",
  "wall-mount-cabinet-vertical": "Wall-mounted cabinet (vertical)",
}

const DIMENSION_UNIT_LABELS: Record<DimensionUnit, string> = {
  mm: "Millimeters",
  in: "Inches",
}

const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  kg: "Kilograms",
  g: "Grams",
  lb: "Pounds",
  oz: "Ounces",
}

// --- Component ---

export function RackPropertiesPanel({ rackId }: RackPropertiesPanelProps) {
  const rack = useRackStore((s) => s.racks[rackId])
  const updateRack = useRackStore((s) => s.updateRack)

  if (!rack) return null

  function update(updates: Partial<RackState>) {
    updateRack(rackId, updates)
  }

  return (
    <div className="p-3 space-y-4">
      <RackNameHeader
        name={rack.name}
        onChange={(name) => update({ name })}
      />

      <Field label="Rack Type" help="Select a pre-defined rack type to auto-fill dimensions, or leave empty for a custom rack.">
        <RackTypePicker
          value={rack.rackType ?? ""}
          onChange={(rackType, fills) => {
            const updates: Partial<RackState> = { rackType }
            if (fills) {
              if (fills.formFactor) updates.formFactor = fills.formFactor
              if (fills.uCount) updates.uCount = fills.uCount
              if (fills.widthInches) updates.widthInches = fills.widthInches
              if (fills.outerWidth) updates.outerWidth = fills.outerWidth
              if (fills.outerHeight) updates.outerHeight = fills.outerHeight
              if (fills.outerDepth) updates.outerDepth = fills.outerDepth
              if (fills.outerDimensionUnit) updates.outerDimensionUnit = fills.outerDimensionUnit
              if (fills.weight) updates.weight = fills.weight
              if (fills.maxWeight) updates.maxWeight = fills.maxWeight
              if (fills.weightUnit) updates.weightUnit = fills.weightUnit
              if (fills.mountingDepth) updates.mountingDepth = fills.mountingDepth
              if (fills.startingUnit) updates.startingUnit = fills.startingUnit
            }
            update(updates)
          }}
        />
      </Field>

      <Section title="Dimensions">
        <Field label="Form Factor" help="Physical form of the rack.">
          <SmallSelect
            value={rack.formFactor ?? ""}
            onValueChange={(v) => update({ formFactor: v as RackFormFactor })}
            placeholder="Select form factor"
          >
            {RACK_FORM_FACTORS.map((f) => (
              <SelectItem key={f} value={f}>{FORM_FACTOR_LABELS[f]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Width" help="Rail-to-rail width of the rack.">
          <SmallSelect
            value={rack.widthInches != null ? String(rack.widthInches) : ""}
            onValueChange={(v) => update({ widthInches: Number(v) })}
            placeholder="Select width"
          >
            {RACK_WIDTHS.map((w) => (
              <SelectItem key={w} value={String(w)}>{w} inches</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Starting Unit" help="The number of the first rack unit (U) — useful for racks that don't start at U1.">
          <Input
            className="h-8 text-xs"
            type="number"
            min={1}
            value={rack.startingUnit ?? 1}
            onChange={(e) => update({ startingUnit: Number(e.target.value) || 1 })}
          />
        </Field>

        <Field label="Height (U)" help="Total height of the rack in rack units.">
          <Input
            className="h-8 text-xs"
            type="number"
            min={1}
            max={60}
            list="rack-size-presets"
            value={rack.uCount}
            onChange={(e) => update({ uCount: Number(e.target.value) || 42 })}
          />
          <datalist id="rack-size-presets">
            {RACK_SIZES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider pt-1">
          Outer Dimensions
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          <Field label="Width" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="W"
              value={rack.outerWidth ?? ""}
              onChange={(e) => update({ outerWidth: Number(e.target.value) || undefined })}
            />
          </Field>
          <Field label="Height" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="H"
              value={rack.outerHeight ?? ""}
              onChange={(e) => update({ outerHeight: Number(e.target.value) || undefined })}
            />
          </Field>
          <Field label="Depth" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="D"
              value={rack.outerDepth ?? ""}
              onChange={(e) => update({ outerDepth: Number(e.target.value) || undefined })}
            />
          </Field>
        </div>

        <Field label="Dimension Unit" help="Unit for outer dimension measurements.">
          <SmallSelect
            value={rack.outerDimensionUnit ?? ""}
            onValueChange={(v) => update({ outerDimensionUnit: v as DimensionUnit })}
            placeholder="Select unit"
          >
            {DIMENSION_UNITS.map((u) => (
              <SelectItem key={u} value={u}>{DIMENSION_UNIT_LABELS[u]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Weight" help="Weight of the rack itself.">
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="0"
              value={rack.weight ?? ""}
              onChange={(e) => update({ weight: Number(e.target.value) || undefined })}
            />
          </Field>
          <Field label="Max Weight" help="Maximum load the rack can support.">
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="0"
              value={rack.maxWeight ?? ""}
              onChange={(e) => update({ maxWeight: Number(e.target.value) || undefined })}
            />
          </Field>
        </div>

        <Field label="Weight Unit" help="Unit for weight values.">
          <SmallSelect
            value={rack.weightUnit ?? ""}
            onValueChange={(v) => update({ weightUnit: v as WeightUnit })}
            placeholder="Select unit"
          >
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Mounting Depth" help="Maximum depth (mm) of a device that can be mounted. For 4-post racks, distance between front and rear rails.">
          <Input
            className="h-8 text-xs"
            type="number"
            min={0}
            placeholder="mm"
            value={rack.mountingDepth ?? ""}
            onChange={(e) => update({ mountingDepth: Number(e.target.value) || undefined })}
          />
        </Field>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Descending Units</Label>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Number units top-to-bottom instead of bottom-to-top.
            </p>
          </div>
          <Switch
            checked={rack.descendingUnits ?? false}
            onCheckedChange={(checked) => update({ descendingUnits: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Allow Overlap</Label>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Disable collision enforcement for this rack.
            </p>
          </div>
          <Switch
            checked={rack.allowOverlap ?? false}
            onCheckedChange={(checked) => update({ allowOverlap: checked })}
          />
        </div>
      </Section>

      <Section title="Rack">
        <Field label="Status" help="Current operational status.">
          <SmallSelect
            value={rack.status ?? ""}
            onValueChange={(v) => update({ status: v as RackStatus })}
            placeholder="Select status"
          >
            {RACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Site" help="The physical site where the rack is located.">
          <Input
            className="h-8 text-xs"
            placeholder="e.g. milton"
            value={rack.site ?? ""}
            onChange={(e) => update({ site: e.target.value })}
          />
        </Field>

        <Field label="Location" help="Sub-location within the site (e.g. room or floor).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.location ?? ""}
            onChange={(e) => update({ location: e.target.value })}
          />
        </Field>

        <Field label="Role" help="Functional role for the rack (e.g. Networking, Storage).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.role ?? ""}
            onChange={(e) => update({ role: e.target.value })}
          />
        </Field>

        <Field label="Description" help="A short free-text description of the rack.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>

        <Field label="Airflow" help="Direction of airflow through the rack.">
          <SmallSelect
            value={rack.airflow ?? ""}
            onValueChange={(v) => update({ airflow: v as RackAirflow })}
            placeholder="Select airflow"
          >
            {RACK_AIRFLOWS.map((a) => (
              <SelectItem key={a} value={a}>{AIRFLOW_LABELS[a]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Tags" help="Comma-separated tags for categorizing or filtering the rack.">
          <Input
            className="h-8 text-xs"
            placeholder="tag1, tag2"
            value={(rack.tags ?? []).join(", ")}
            onChange={(e) => {
              const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
              update({ tags })
            }}
          />
        </Field>
      </Section>

      <Section title="Inventory Control">
        <Field label="Facility ID" help="A locally-assigned identifier for the rack (e.g. a data center facility label).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.facilityId ?? ""}
            onChange={(e) => update({ facilityId: e.target.value })}
          />
        </Field>

        <Field label="Serial Number" help="The manufacturer serial number of the rack.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.serialNumber ?? ""}
            onChange={(e) => update({ serialNumber: e.target.value })}
          />
        </Field>

        <Field label="Asset Tag" help="A unique tag used to identify this rack (e.g. a barcode or asset management ID).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.assetTag ?? ""}
            onChange={(e) => update({ assetTag: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Tenancy">
        <Field label="Tenant Group" help="Optional grouping to filter the Tenant list.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.tenantGroup ?? ""}
            onChange={(e) => update({ tenantGroup: e.target.value })}
          />
        </Field>

        <Field label="Tenant" help="The tenant (organization/customer) assigned to this rack.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.tenant ?? ""}
            onChange={(e) => update({ tenant: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Ownership">
        <Field label="Owner Group" help="Optional group to filter the Owner list.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.ownerGroup ?? ""}
            onChange={(e) => update({ ownerGroup: e.target.value })}
          />
        </Field>

        <Field label="Owner" help="The owner assigned to this rack.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={rack.owner ?? ""}
            onChange={(e) => update({ owner: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Other">
        <Field label="Comments" help="Free text/Markdown notes about the rack.">
          <Textarea
            className="text-xs min-h-[60px]"
            placeholder="Optional"
            value={rack.comments ?? ""}
            onChange={(e) => update({ comments: e.target.value })}
          />
        </Field>
      </Section>
    </div>
  )
}

// --- Editable name header ---

function RackNameHeader({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== name) onChange(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border">
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setEditing(false)
          }}
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-primary"
        />
      ) : (
        <>
          <h2 className="flex-1 text-sm font-semibold text-foreground truncate" title={name}>
            {name}
          </h2>
          <button
            onClick={() => { setEditValue(name); setEditing(true) }}
            className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit rack name"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

// --- Helpers ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border pb-3 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left mb-2 group"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {open ? "\u25B4" : "\u25BE"}
        </span>
      </button>
      {open && <div className="space-y-2.5">{children}</div>}
    </div>
  )
}

function Field({
  label,
  help,
  compact,
  children,
}: {
  label: string
  help?: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={compact ? "" : "space-y-1"}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {help && !compact && (
        <p className="text-[10px] text-muted-foreground/70 leading-tight">{help}</p>
      )}
    </div>
  )
}

function SmallSelect({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}
