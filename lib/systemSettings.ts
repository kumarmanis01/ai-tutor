import { prisma } from "./prisma"

export function isSystemSettingEnabled(value: unknown): boolean {
  if (value === true || value === "true") return true
  if (typeof value === "object" && value !== null && Object.prototype.hasOwnProperty.call(value, "enabled")) {
    const v = (value as any).enabled
    return v === true || v === "true"
  }
  return false
}

export async function getSystemSettingEnabled(key: string): Promise<boolean> {
  const s = await prisma.systemSetting.findUnique({ where: { key } })
  return isSystemSettingEnabled(s?.value)
}
