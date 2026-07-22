import type { IconType } from "react-icons";
import {
  PiArticle,
  PiArrowsLeftRight,
  PiCalendarBlank,
  PiCheckSquare,
  PiCircleDashed,
  PiClock,
  PiClockClockwise,
  PiEnvelopeSimple,
  PiFile,
  PiFunction,
  PiHash,
  PiLink,
  PiListBullets,
  PiPhone,
  PiStack,
  PiTag,
  PiTextT,
  PiUser,
  PiUserCircle,
  PiUsers,
} from "react-icons/pi";
import type { DatabasePropertyConfig } from "../types/database";

const PROPERTY_TYPE_ICONS: Record<
  DatabasePropertyConfig["type"],
  IconType
> = {
  title: PiTextT,
  rich_text: PiArticle,
  number: PiHash,
  select: PiTag,
  multi_select: PiListBullets,
  status: PiCircleDashed,
  date: PiCalendarBlank,
  people: PiUsers,
  files: PiFile,
  checkbox: PiCheckSquare,
  url: PiLink,
  email: PiEnvelopeSimple,
  phone_number: PiPhone,
  formula: PiFunction,
  relation: PiArrowsLeftRight,
  rollup: PiStack,
  created_time: PiClock,
  created_by: PiUser,
  last_edited_time: PiClockClockwise,
  last_edited_by: PiUserCircle,
};

export function databasePropertyTypeIcon(
  type: DatabasePropertyConfig["type"],
): IconType {
  return PROPERTY_TYPE_ICONS[type] ?? PiTag;
}
