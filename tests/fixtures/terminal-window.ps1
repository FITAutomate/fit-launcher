param([Parameter(Mandatory=$true)][string]$TitleToken)
$ErrorActionPreference='Stop'
# Read-only window instrumentation for the disposable terminal fixture.
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class TerminalWindowProbe {
    private delegate bool EnumProc(IntPtr handle, IntPtr unused);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr unused);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int length);
    public static int Count(string token) {
        int count = 0;
        EnumWindows((handle, unused) => {
            var text = new StringBuilder(1024);
            GetWindowText(handle, text, text.Capacity);
            if (IsWindowVisible(handle) && text.ToString().Contains(token)) count++;
            return true;
        }, IntPtr.Zero);
        return count;
    }
}
'@
@{visibleCount=[TerminalWindowProbe]::Count($TitleToken)} | ConvertTo-Json -Compress
