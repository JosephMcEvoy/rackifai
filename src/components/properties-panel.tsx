import { useState, useMemo, useRef, useEffect } from "react"
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
  DEVICE_AIRFLOWS,
  DEVICE_STATUSES,
  DEVICE_FACES,
  type DeviceState,
  type DeviceAirflow,
  type DeviceStatus,
  type DeviceFace,
} from "@/store/rack-store"
import { DEVICE_COLORS, DEVICE_CATEGORIES, type DeviceCategory } from "@/canvas/device"
import { getCatalogDevices } from "@/lib/catalog-data"
import { DeviceImagePreview } from "@/components/device-image-preview"

// --- Props ---

interface PropertiesPanelProps {
  deviceIds: string[]
}

// --- Display labels ---

const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  server: "Server",
  switch: "Switch",
  patch_panel: "Patch Panel",
  pdu: "PDU",
  storage: "Storage",
  ups: "UPS",
  blank: "Blank",
  other: "Other",
}

const AIRFLOW_LABELS: Record<DeviceAirflow, string> = {
  "front-to-rear": "Front to rear",
  "rear-to-front": "Rear to front",
  "left-to-right": "Left to right",
  "right-to-left": "Right to left",
  "side-to-rear": "Side to rear",
  "rear-to-side": "Rear to side",
  "bottom-to-top": "Bottom to top",
  "top-to-bottom": "Top to bottom",
  passive: "Passive",
  mixed: "Mixed",
}

const STATUS_LABELS: Record<DeviceStatus, string> = {
  active: "Active",
  offline: "Offline",
  planned: "Planned",
  staged: "Staged",
  failed: "Failed",
  inventory: "Inventory",
  decommissioning: "Decommissioning",
}

const FACE_LABELS: Record<DeviceFace, string> = {
  front: "Front",
  rear: "Rear",
}

// --- Component ---

export function PropertiesPanel({ deviceIds }: PropertiesPanelProps) {
  if (deviceIds.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Select a device to view its properties
      </div>
    )
  }

  if (deviceIds.length > 1) {
    return <MultiDevicePanel deviceIds={deviceIds} />
  }

  return <SingleDevicePanel deviceId={deviceIds[0]} />
}

function MultiDevicePanel({ deviceIds }: { deviceIds: string[] }) {
  const allDevices = useRackStore((s) => s.devices)
  const devices = deviceIds.map((id) => allDevices[id]).filter(Boolean)

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Multi-Selection
      </h3>
      <div className="space-y-2">
        <Row label="Selected" value={`${devices.length} devices`} />
        <Row label="Total Power" value={`${devices.reduce((s, d) => s + d.powerWatts, 0)}W`} />
        <Row label="Total Weight" value={`${devices.reduce((s, d) => s + d.weightKg, 0).toFixed(1)} kg`} />
        <Row label="Total U" value={`${devices.reduce((s, d) => s + d.uHeight, 0)}U`} />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Delete to remove all. Ctrl+D to duplicate.
      </p>
    </div>
  )
}

function SingleDevicePanel({ deviceId }: { deviceId: string }) {
  const device = useRackStore((s) => s.devices[deviceId])
  const updateDevice = useRackStore((s) => s.updateDevice)

  // Look up catalog entry for image URLs
  const catalogImages = useMemo(() => {
    if (!device) return null
    const catalog = getCatalogDevices()
    const entry = catalog.find((c) => c.catalogId === device.catalogId)
    if (!entry || (!entry.frontImageUrl && !entry.rearImageUrl)) return null
    return { frontImageUrl: entry.frontImageUrl, rearImageUrl: entry.rearImageUrl }
  }, [device])

  if (!device) return null

  function update(updates: Partial<DeviceState>) {
    updateDevice(deviceId, updates)
  }

  return (
    <div className="p-3 space-y-4">
      <DeviceNameHeader
        name={device.name}
        color={DEVICE_COLORS[device.category]}
        onChange={(name) => update({ name })}
      />

      {catalogImages && (
        <DeviceImagePreview
          frontImageUrl={catalogImages.frontImageUrl}
          rearImageUrl={catalogImages.rearImageUrl}
          face={device.face ?? "front"}
          deviceName={device.name}
        />
      )}

      <Section title="Device">
        <Field label="Device Role" help="Functional role of the device (e.g. Router, Switch, Server).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.deviceRole ?? ""}
            onChange={(e) => update({ deviceRole: e.target.value })}
          />
        </Field>

        <Field label="Description" help="A short free-text description of the device.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>

        <Field label="Tags" help="Comma-separated tags for categorizing or filtering the device.">
          <Input
            className="h-8 text-xs"
            placeholder="tag1, tag2"
            value={(device.tags ?? []).join(", ")}
            onChange={(e) => {
              const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
              update({ tags })
            }}
          />
        </Field>
      </Section>

      <Section title="Hardware">
        <Field label="Category" help="Primary category of the device.">
          <SmallSelect
            value={device.category}
            onValueChange={(v) => update({ category: v as DeviceCategory })}
            placeholder="Select category"
          >
            {DEVICE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Device Type" help="Links the device to a pre-defined device type (manufacturer + model).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.deviceType ?? ""}
            onChange={(e) => update({ deviceType: e.target.value })}
          />
        </Field>

        <Field label="Manufacturer">
          <Input
            className="h-8 text-xs"
            value={device.manufacturer}
            onChange={(e) => update({ manufacturer: e.target.value })}
          />
        </Field>

        <Field label="Model">
          <Input
            className="h-8 text-xs"
            value={device.model}
            onChange={(e) => update({ model: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="U-Height" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={1}
              max={42}
              value={device.uHeight}
              onChange={(e) => update({ uHeight: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Depth" compact>
            <div className="flex items-center h-8 gap-2">
              <Switch
                checked={device.isFullDepth}
                onCheckedChange={(checked) => update({ isFullDepth: checked })}
              />
              <span className="text-xs text-muted-foreground">
                {device.isFullDepth ? "Full" : "Half"}
              </span>
            </div>
          </Field>
        </div>

        <Field label="Airflow" help="Direction of airflow through the device.">
          <SmallSelect
            value={device.airflow ?? ""}
            onValueChange={(v) => update({ airflow: v as DeviceAirflow })}
            placeholder="Select airflow"
          >
            {DEVICE_AIRFLOWS.map((a) => (
              <SelectItem key={a} value={a}>{AIRFLOW_LABELS[a]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Serial Number" help="The chassis serial number assigned by the manufacturer.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.serialNumber ?? ""}
            onChange={(e) => update({ serialNumber: e.target.value })}
          />
        </Field>

        <Field label="Asset Tag" help="A unique tag used to identify this device (e.g. barcode or asset management ID).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.assetTag ?? ""}
            onChange={(e) => update({ assetTag: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Power" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="W"
              value={device.powerWatts || ""}
              onChange={(e) => update({ powerWatts: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Weight" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              step={0.1}
              placeholder="kg"
              value={device.weightKg || ""}
              onChange={(e) => update({ weightKg: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Location">
        <Field label="Site" help="The physical site where the device is installed.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.site ?? ""}
            onChange={(e) => update({ site: e.target.value })}
          />
        </Field>

        <Field label="Location" help="An optional sub-location within the site (e.g. room or floor).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.location ?? ""}
            onChange={(e) => update({ location: e.target.value })}
          />
        </Field>

        <Field label="Face" help="Which face of the rack the device is mounted on.">
          <SmallSelect
            value={device.face ?? ""}
            onValueChange={(v) => update({ face: v as DeviceFace })}
            placeholder="Select face"
          >
            {DEVICE_FACES.map((f) => (
              <SelectItem key={f} value={f}>{FACE_LABELS[f]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Position (U)" help="The lowest-numbered rack unit occupied by the device.">
          <Input
            className="h-8 text-xs"
            type="number"
            min={1}
            value={device.startU}
            onChange={(e) => update({ startU: Number(e.target.value) || 1 })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Latitude" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              step={0.000001}
              placeholder="xx.yyyyyy"
              value={device.latitude ?? ""}
              onChange={(e) => update({ latitude: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Longitude" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              step={0.000001}
              placeholder="xx.yyyyyy"
              value={device.longitude ?? ""}
              onChange={(e) => update({ longitude: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Management">
        <Field label="Status" help="Current operational status.">
          <SmallSelect
            value={device.status ?? ""}
            onValueChange={(v) => update({ status: v as DeviceStatus })}
            placeholder="Select status"
          >
            {DEVICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SmallSelect>
        </Field>

        <Field label="Platform" help="The software platform/OS running on the device (e.g. Cisco IOS, Linux).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.platform ?? ""}
            onChange={(e) => update({ platform: e.target.value })}
          />
        </Field>

        <Field label="Config Template" help="An optional configuration template for automated provisioning.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.configTemplate ?? ""}
            onChange={(e) => update({ configTemplate: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Virtualization">
        <Field label="Cluster" help="Associates this device with a virtualization cluster.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.cluster ?? ""}
            onChange={(e) => update({ cluster: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Tenancy">
        <Field label="Tenant Group" help="Optional group to filter the Tenant list.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.tenantGroup ?? ""}
            onChange={(e) => update({ tenantGroup: e.target.value })}
          />
        </Field>

        <Field label="Tenant" help="The tenant (organization/customer) assigned to this device.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.tenant ?? ""}
            onChange={(e) => update({ tenant: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Virtual Chassis">
        <Field label="Virtual Chassis" help="Associates this device with a virtual chassis group (e.g. a stacked switch).">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.virtualChassis ?? ""}
            onChange={(e) => update({ virtualChassis: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Position" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="0"
              value={device.vcPosition ?? ""}
              onChange={(e) => update({ vcPosition: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Priority" compact>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              placeholder="0"
              value={device.vcPriority ?? ""}
              onChange={(e) => update({ vcPriority: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Ownership">
        <Field label="Owner Group" help="Optional group to filter the Owner list.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.ownerGroup ?? ""}
            onChange={(e) => update({ ownerGroup: e.target.value })}
          />
        </Field>

        <Field label="Owner" help="The owner assigned to this device.">
          <Input
            className="h-8 text-xs"
            placeholder="Optional"
            value={device.owner ?? ""}
            onChange={(e) => update({ owner: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Other">
        <Field label="Local Config Context" help="Freeform JSON field for local configuration context data.">
          <Textarea
            className="text-xs min-h-[60px] font-mono"
            placeholder='{"key": "value"}'
            value={device.localConfigContext ?? ""}
            onChange={(e) => update({ localConfigContext: e.target.value })}
          />
        </Field>

        <Field label="Comments" help="Free text/Markdown notes about the device.">
          <Textarea
            className="text-xs min-h-[60px]"
            placeholder="Optional"
            value={device.comments ?? ""}
            onChange={(e) => update({ comments: e.target.value })}
          />
        </Field>
      </Section>
    </div>
  )
}

// --- Multi-select summary row ---

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  )
}

// --- Editable name header ---

function DeviceNameHeader({
  name,
  color,
  onChange,
}: {
  name: string
  color: string
  onChange: (name: string) => void
}) {
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
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
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
            title="Edit device name"
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
