/**
 * Print a page built as a string, without leaving Béa.
 *
 * The page goes into a hidden frame and that frame is printed, so the print
 * dialog shows the plan rather than the app around it. "Save as PDF" is one
 * of the dialog's printers on every phone and computer.
 */
export function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    // Left in place a while: some browsers print after print() returns.
    window.setTimeout(() => frame.remove(), 60_000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
