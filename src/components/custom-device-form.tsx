import { useState, useEffect } from "react"
import { DEVICE_CATEGORIES, DEVICE_COLORS, type DeviceCategory } from "@/canvas/device"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  useCustomDevicesStore,
  type CustomDevice,
} from "@/store/custom-devices-store"

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

interface CustomDeviceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editDevice?: CustomDevice | null
}

const DEFAULT_FORM: Omit<CustomDevice, "catalogId"> = {
  name: "",
  manufacturer: "",
  model: "",
  uHeight: 1,
  isFullDepth: true,
  category: "server",
  powerWatts: 0,
  weightKg: 0,
  color: DEVICE_COLORS.server,
  notes: "",
}

export function CustomDeviceForm({
  open,
  onOpenChange,
  editDevice,
}: CustomDeviceFormProps) {
  const addDevice = useCustomDevicesStore((s) => s.addDevice)
  const updateDevice = useCustomDevicesStore((s) => s.updateDevice)

  function deviceToForm(device: CustomDevice): Omit<CustomDevice, "catalogId"> {
    const { catalogId: _, ...rest } = device // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest
  }

  const [form, setForm] = useState(DEFAULT_FORM)

  // Reset form when dialog opens/closes or editDevice changes
  const formKey = open ? (editDevice?.catalogId ?? "new") : "closed"
  useEffect(() => {
    if (open) {
      setForm(editDevice ? deviceToForm(editDevice) : DEFAULT_FORM)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey])

  const isEditing = !!editDevice
  const isValid = form.name.trim().length > 0

  function handleCategoryChange(category: DeviceCategory) {
    setForm((f) => ({
      ...f,
      category,
      color: DEVICE_COLORS[category],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    const device: CustomDevice = {
      catalogId: isEditing
        ? editDevice.catalogId
        : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...form,
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim(),
      model: form.model.trim(),
      notes: form.notes.trim(),
    }

    if (isEditing) {
      updateDevice(editDevice.catalogId, device)
    } else {
      addDevice(device)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Custom Device" : "Add Custom Device"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the device type properties."
              : "Create a new device type for your rack catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="device-name">Name *</Label>
            <Input
              id="device-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Custom 2U Server"
            />
          </div>

          {/* Manufacturer + Model row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="device-manufacturer">Manufacturer</Label>
              <Input
                id="device-manufacturer"
                value={form.manufacturer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, manufacturer: e.target.value }))
                }
                placeholder="e.g. Dell"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-model">Model</Label>
              <Input
                id="device-model"
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                placeholder="e.g. R760"
              />
            </div>
          </div>

          {/* U-height + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="device-uheight">U-Height</Label>
              <Select
                value={String(form.uHeight)}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, uHeight: Number(v) }))
                }
              >
                <SelectTrigger id="device-uheight">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((u) => (
                    <SelectItem key={u} value={String(u)}>
                      {u}U
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  handleCategoryChange(v as DeviceCategory)
                }
              >
                <SelectTrigger id="device-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Full depth toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="device-fulldepth">Full depth</Label>
            <Switch
              id="device-fulldepth"
              checked={form.isFullDepth}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isFullDepth: checked }))
              }
            />
          </div>

          {/* Power + Weight row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="device-power">Power (watts)</Label>
              <Input
                id="device-power"
                type="number"
                min={0}
                max={20000}
                value={form.powerWatts}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    powerWatts: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-weight">Weight (kg)</Label>
              <Input
                id="device-weight"
                type="number"
                min={0}
                max={500}
                step={0.1}
                value={form.weightKg}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    weightKg: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label htmlFor="device-color">Color</Label>
            <div className="flex items-center gap-3">
              <input
                id="device-color"
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {form.color}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="device-notes">Notes</Label>
            <Textarea
              id="device-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Optional notes about this device type..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              {isEditing ? "Save Changes" : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
