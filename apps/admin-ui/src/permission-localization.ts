import BUILT_IN_PERMISSION_ZHResource from '@remoteai/i18n/copy/admin/permissions';
import type { Language } from "./i18n";
import type { PermissionDefinition } from "./types";

type PermissionMetadata = Pick<PermissionDefinition, "group" | "name" | "description">;

const BUILT_IN_PERMISSION_ZH: Record<string, PermissionMetadata> = BUILT_IN_PERMISSION_ZHResource;

export function localizePermission(
  permission: PermissionDefinition,
  language: Language,
): PermissionDefinition {
  if (language !== "zh" || !permission.system) return permission;
  const metadata = BUILT_IN_PERMISSION_ZH[permission.code];
  return metadata ? { ...permission, ...metadata } : permission;
}
