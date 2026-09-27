/**
 * Béa's icons: Phosphor (Regular), the set the master design is drawn with.
 *
 * Every screen imports icons from here under the names it always used (the
 * Lucide names), so the whole app changed set in one place and a screen reads
 * the same as before. `strokeWidth` above 2 — the active tab — maps to
 * Phosphor's Bold weight; `weight` can also be passed directly ("fill" for a
 * saved bookmark).
 */
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import {
  AirplaneTakeoff as PhAirplaneTakeoff,
  AirplaneTilt as PhAirplaneTilt,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsOut as PhArrowsOut,
  Backpack as PhBackpack,
  Bank as PhBank,
  Bathtub as PhBathtub,
  Bed as PhBed,
  BookOpen as PhBookOpen,
  BookmarkSimple as PhBookmarkSimple,
  Briefcase as PhBriefcase,
  CalendarBlank as PhCalendarBlank,
  CalendarDots as PhCalendarDots,
  Camera as PhCamera,
  Car as PhCar,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  Checks as PhChecks,
  CircleDashed as PhCircleDashed,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  Cloud as PhCloud,
  CloudFog as PhCloudFog,
  CloudLightning as PhCloudLightning,
  CloudMoon as PhCloudMoon,
  CloudRain as PhCloudRain,
  CloudSlash as PhCloudSlash,
  CloudSnow as PhCloudSnow,
  CloudSun as PhCloudSun,
  Columns as PhColumns,
  Compass as PhCompass,
  Copy as PhCopy,
  Crosshair as PhCrosshair,
  DeviceMobile as PhDeviceMobile,
  DotsThree as PhDotsThree,
  DotsThreeVertical as PhDotsThreeVertical,
  DownloadSimple as PhDownloadSimple,
  FileText as PhFileText,
  Footprints as PhFootprints,
  ForkKnife as PhForkKnife,
  Gear as PhGear,
  Globe as PhGlobe,
  GlobeHemisphereWest as PhGlobeHemisphereWest,
  GraduationCap as PhGraduationCap,
  Hand as PhHand,
  House as PhHouse,
  Image as PhImage,
  Lightbulb as PhLightbulb,
  Link as PhLink,
  ListChecks as PhListChecks,
  ListNumbers as PhListNumbers,
  ListPlus as PhListPlus,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  MapPinPlus as PhMapPinPlus,
  MapTrifold as PhMapTrifold,
  Minus as PhMinus,
  Moon as PhMoon,
  Note as PhNote,
  Package as PhPackage,
  Path as PhPath,
  PawPrint as PhPawPrint,
  PencilSimple as PhPencilSimple,
  PersonArmsSpread as PhPersonArmsSpread,
  Phone as PhPhone,
  Pill as PhPill,
  PlayCircle as PhPlayCircle,
  Plug as PhPlug,
  Plus as PhPlus,
  ShareNetwork as PhShareNetwork,
  ShieldCheck as PhShieldCheck,
  SlidersHorizontal as PhSlidersHorizontal,
  Snowflake as PhSnowflake,
  Sparkle as PhSparkle,
  Stamp as PhStamp,
  SuitcaseRolling as PhSuitcaseRolling,
  Sun as PhSun,
  Syringe as PhSyringe,
  TShirt as PhTShirt,
  Tag as PhTag,
  Ticket as PhTicket,
  Trash as PhTrash,
  Tray as PhTray,
  User as PhUser,
  UserCircle as PhUserCircle,
  Users as PhUsers,
  Wallet as PhWallet,
  X as PhX,
  type Icon as PhosphorIcon,
  type IconProps,
  type IconWeight,
  Export as PhExport,
} from "@phosphor-icons/react";

export type LucideProps = Omit<ComponentPropsWithoutRef<"svg">, "ref"> & {
  size?: number | string;
  strokeWidth?: number | string;
  weight?: IconWeight;
};

function icon(Glyph: PhosphorIcon, name: string) {
  const Wrapped = forwardRef<SVGSVGElement, LucideProps>(function BeaIcon(
    { size = 24, strokeWidth, weight, ...rest },
    ref,
  ) {
    const bold = strokeWidth !== undefined && Number(strokeWidth) > 2;
    // Phosphor's props are the SVG's, with optional fields that may not be
    // `undefined` under exactOptionalPropertyTypes; the spread is the same props.
    const props = { ...rest, size, weight: weight ?? (bold ? "bold" : "regular") } as IconProps;
    return <Glyph ref={ref} {...props} />;
  });
  Wrapped.displayName = name;
  return Wrapped;
}

export const Accessibility = icon(PhPersonArmsSpread, "Accessibility");
export const ArrowLeft = icon(PhArrowLeft, "ArrowLeft");
export const ArrowRight = icon(PhArrowRight, "ArrowRight");
export const Backpack = icon(PhBackpack, "Backpack");
export const Bath = icon(PhBathtub, "Bath");
export const Bed = icon(PhBed, "Bed");
export const BedDouble = icon(PhBed, "BedDouble");
export const BookOpen = icon(PhBookOpen, "BookOpen");
export const Bookmark = icon(PhBookmarkSimple, "Bookmark");
export const Briefcase = icon(PhBriefcase, "Briefcase");
export const CalendarClock = icon(PhCalendarDots, "CalendarClock");
export const CalendarDays = icon(PhCalendarBlank, "CalendarDays");
export const Camera = icon(PhCamera, "Camera");
export const Car = icon(PhCar, "Car");
export const Check = icon(PhCheck, "Check");
export const CheckCheck = icon(PhChecks, "CheckCheck");
export const CheckCircle2 = icon(PhCheckCircle, "CheckCircle2");
export const ChevronDown = icon(PhCaretDown, "ChevronDown");
export const ChevronLeft = icon(PhCaretLeft, "ChevronLeft");
export const ChevronRight = icon(PhCaretRight, "ChevronRight");
export const ChevronUp = icon(PhCaretUp, "ChevronUp");
export const CircleCheck = icon(PhCheckCircle, "CircleCheck");
export const CircleDashed = icon(PhCircleDashed, "CircleDashed");
export const ClipboardList = icon(PhClipboardText, "ClipboardList");
export const Clock = icon(PhClock, "Clock");
export const Cloud = icon(PhCloud, "Cloud");
export const CloudFog = icon(PhCloudFog, "CloudFog");
export const CloudLightning = icon(PhCloudLightning, "CloudLightning");
export const CloudMoon = icon(PhCloudMoon, "CloudMoon");
export const CloudOff = icon(PhCloudSlash, "CloudOff");
export const CloudRain = icon(PhCloudRain, "CloudRain");
export const CloudSnow = icon(PhCloudSnow, "CloudSnow");
export const CloudSun = icon(PhCloudSun, "CloudSun");
export const Columns2 = icon(PhColumns, "Columns2");
export const Compass = icon(PhCompass, "Compass");
export const Copy = icon(PhCopy, "Copy");
export const Download = icon(PhDownloadSimple, "Download");
export const EllipsisVertical = icon(PhDotsThreeVertical, "EllipsisVertical");
export const ExternalLink = icon(PhArrowSquareOut, "ExternalLink");
export const FileText = icon(PhFileText, "FileText");
export const Footprints = icon(PhFootprints, "Footprints");
export const Globe = icon(PhGlobe, "Globe");
export const Globe2 = icon(PhGlobeHemisphereWest, "Globe2");
export const GraduationCap = icon(PhGraduationCap, "GraduationCap");
export const Hand = icon(PhHand, "Hand");
export const Home = icon(PhHouse, "Home");
export const House = icon(PhHouse, "House");
export const Image = icon(PhImage, "Image");
export const Inbox = icon(PhTray, "Inbox");
export const Landmark = icon(PhBank, "Landmark");
export const Lightbulb = icon(PhLightbulb, "Lightbulb");
export const Link2 = icon(PhLink, "Link2");
export const ListChecks = icon(PhListChecks, "ListChecks");
export const ListOrdered = icon(PhListNumbers, "ListOrdered");
export const ListPlus = icon(PhListPlus, "ListPlus");
export const LocateFixed = icon(PhCrosshair, "LocateFixed");
export const Luggage = icon(PhSuitcaseRolling, "Luggage");
export const Map = icon(PhMapTrifold, "Map");
export const MapPin = icon(PhMapPin, "MapPin");
export const MapPinPlus = icon(PhMapPinPlus, "MapPinPlus");
export const MapPinned = icon(PhMapTrifold, "MapPinned");
export const Maximize2 = icon(PhArrowsOut, "Maximize2");
export const Minus = icon(PhMinus, "Minus");
export const Moon = icon(PhMoon, "Moon");
export const MoreHorizontal = icon(PhDotsThree, "MoreHorizontal");
export const Package = icon(PhPackage, "Package");
export const PawPrint = icon(PhPawPrint, "PawPrint");
export const Pencil = icon(PhPencilSimple, "Pencil");
export const Phone = icon(PhPhone, "Phone");
export const Pill = icon(PhPill, "Pill");
export const Plane = icon(PhAirplaneTilt, "Plane");
export const PlaneTakeoff = icon(PhAirplaneTakeoff, "PlaneTakeoff");
export const PlayCircle = icon(PhPlayCircle, "PlayCircle");
export const Plug = icon(PhPlug, "Plug");
export const Plus = icon(PhPlus, "Plus");
export const RefreshCw = icon(PhArrowsClockwise, "RefreshCw");
export const RotateCcw = icon(PhArrowCounterClockwise, "RotateCcw");
export const Route = icon(PhPath, "Route");
export const Search = icon(PhMagnifyingGlass, "Search");
export const Settings = icon(PhGear, "Settings");
export const Settings2 = icon(PhSlidersHorizontal, "Settings2");
export const Share2 = icon(PhShareNetwork, "Share2");
export const ShieldCheck = icon(PhShieldCheck, "ShieldCheck");
export const Shirt = icon(PhTShirt, "Shirt");
export const Smartphone = icon(PhDeviceMobile, "Smartphone");
export const Snowflake = icon(PhSnowflake, "Snowflake");
export const Sparkles = icon(PhSparkle, "Sparkles");
export const Stamp = icon(PhStamp, "Stamp");
export const StickyNote = icon(PhNote, "StickyNote");
export const Sun = icon(PhSun, "Sun");
export const Syringe = icon(PhSyringe, "Syringe");
export const Tag = icon(PhTag, "Tag");
export const Ticket = icon(PhTicket, "Ticket");
export const Trash2 = icon(PhTrash, "Trash2");
export const User = icon(PhUser, "User");
export const UserRound = icon(PhUserCircle, "UserRound");
export const Users = icon(PhUsers, "Users");
export const Utensils = icon(PhForkKnife, "Utensils");
export const Wallet = icon(PhWallet, "Wallet");
export const X = icon(PhX, "X");
export const ImageIcon = Image;
export const MapIcon = Map;
export const RouteIcon = Route;
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const Share = icon(PhExport, "Share");
