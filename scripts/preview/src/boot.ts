import { ACCENT_BOOT_SCRIPT } from "@/lib/accent";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Use the production pre-paint scripts in the component preview too.
new Function(THEME_BOOT_SCRIPT)();
new Function(ACCENT_BOOT_SCRIPT)();
