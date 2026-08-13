# ARCLUX CLI demo tape (VHS).
#
# Regenerate the README demo GIF with:
#
#   vhs demo.tape
#
# Requirements:
#   - Windows: VHS 0.11.0 + MSVC build of ttyd (MinGW ttyd fails ConPTY on
#     Windows 11 25H2, see charmbracelet/vhs#721) + ffmpeg, all on PATH
#   - Linux/macOS: plain `vhs` works out of the box
#   - pnpm dependencies installed (`pnpm install`) so `npx tsx` resolves
#
# The `doskey` line below is only meaningful on Windows (cmd shell); on
# POSIX shells replace it with `alias arclux='npx tsx apps/cli/index.ts'`.

Output demo.gif
Set Width 1200
Set Height 700
Set FontSize 24
Set Framerate 30
Set TypingSpeed 10ms
Set Shell cmd

# expose the CLI under the short name shown in the README
Type "doskey arclux=npx tsx apps\cli\index.ts $*"
Enter
Sleep 1s

# headline command: analyze a real repo (ARCLUX analyzing itself)
Type "arclux analyze ."
Enter
Wait+Screen /modules indexed/
Sleep 3s

# detector summary: circular deps, unused exports, orphan files
Type "arclux doctor playground/express-demo"
Enter
Wait+Screen /Detectors finished/
Sleep 8s
