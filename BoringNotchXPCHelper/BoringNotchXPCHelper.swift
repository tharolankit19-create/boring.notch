//
//  BoringNotchXPCHelper.swift
//  BoringNotchXPCHelper
//
//  Created by Alexander on 2025-11-16.
//

import Foundation
import AppKit
import Darwin
import ApplicationServices
import IOKit
import CoreGraphics

class BoringNotchXPCHelper: NSObject, BoringNotchXPCHelperProtocol {

    // MARK: - NotchSignal agent monitoring

    private struct AgentProcessRow {
        let pid: Int32
        let parentPID: Int32
        let tty: String
        let elapsedSeconds: Double
        let command: String
    }

    @objc func agentSnapshot(with reply: @escaping (NSData) -> Void) {
        DispatchQueue.global(qos: .utility).async {
            let rows = self.readProcessRows()
            let parentByPID = Dictionary(uniqueKeysWithValues: rows.map { ($0.pid, $0.parentPID) })
            let terminalApps = self.runningTerminalApps()

            var seen = Set<String>()
            let processes: [[String: Any]] = rows.compactMap { row in
                guard let kind = self.agentKind(for: row.command) else { return nil }

                let key = "\(kind)-\(row.pid)"
                guard seen.insert(key).inserted else { return nil }

                let cwd = self.workingDirectory(for: row.pid)
                let source = self.sourceTerminal(
                    for: row.pid,
                    parentByPID: parentByPID,
                    runningTerminals: terminalApps
                )

                return [
                    "pid": row.pid,
                    "kind": kind,
                    "elapsedSeconds": row.elapsedSeconds,
                    "cwd": cwd ?? "",
                    "workspaceName": cwd.map { URL(fileURLWithPath: $0).lastPathComponent } ?? "Workspace",
                    "tty": row.tty == "??" ? "" : row.tty,
                    "sourceBundleID": source?.bundleID ?? "",
                    "sourceApp": source?.name ?? "Terminal"
                ]
            }

            let payload: [String: Any] = [
                "generatedAt": Date().timeIntervalSince1970,
                "claudeHookInstalled": self.isClaudeHookInstalled(),
                "processes": processes,
                "claudeEvents": self.readClaudeHookEvents()
            ]

            let data = (try? JSONSerialization.data(withJSONObject: payload, options: []))
                ?? Data(#"{"generatedAt":0,"claudeHookInstalled":false,"processes":[],"claudeEvents":[]}"#.utf8)
            reply(data as NSData)
        }
    }

    @objc func installClaudeHooks(with reply: @escaping (NSDictionary) -> Void) {
        DispatchQueue.global(qos: .utility).async {
            do {
                try self.installNotchSignalClaudeHooks()
                reply(["success": true])
            } catch {
                reply([
                    "success": false,
                    "error": error.localizedDescription
                ])
            }
        }
    }

    private func readProcessRows() -> [AgentProcessRow] {
        let output = runProcess("/bin/ps", arguments: ["-axo", "pid=,ppid=,tty=,etime=,command="])
        return output.split(separator: "\n").compactMap { line in
            let fields = line.split(
                maxSplits: 4,
                omittingEmptySubsequences: true,
                whereSeparator: { $0 == " " || $0 == "\t" }
            )
            guard fields.count == 5,
                  let pid = Int32(fields[0]),
                  let parentPID = Int32(fields[1])
            else { return nil }

            return AgentProcessRow(
                pid: pid,
                parentPID: parentPID,
                tty: String(fields[2]),
                elapsedSeconds: parseElapsed(String(fields[3])),
                command: String(fields[4])
            )
        }
    }

    private func parseElapsed(_ value: String) -> Double {
        let dayAndClock = value.split(separator: "-", maxSplits: 1).map(String.init)
        let days: Double
        let clock: String
        if dayAndClock.count == 2 {
            days = Double(dayAndClock[0]) ?? 0
            clock = dayAndClock[1]
        } else {
            days = 0
            clock = dayAndClock[0]
        }

        let parts = clock.split(separator: ":").compactMap { Double($0) }
        let clockSeconds: Double
        switch parts.count {
        case 3:
            clockSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        case 2:
            clockSeconds = parts[0] * 60 + parts[1]
        case 1:
            clockSeconds = parts[0]
        default:
            clockSeconds = 0
        }
        return days * 86_400 + clockSeconds
    }

    private func agentKind(for command: String) -> String? {
        let lower = command.lowercased()
        let tokens = command
            .split(whereSeparator: { $0 == " " || $0 == "\t" })
            .prefix(5)
            .map { URL(fileURLWithPath: String($0)).lastPathComponent.lowercased() }

        if tokens.contains("claude") || lower.contains("@anthropic-ai/claude-code") {
            return "claude"
        }
        if tokens.contains("codex") || lower.contains("/codex ") || lower.hasSuffix("/codex") {
            return "codex"
        }

        // Generic process-level monitoring only. Rich states are never inferred
        // for these CLIs because they do not expose a provider contract here.
        let genericAgents: Set<String> = ["aider", "opencode", "amp", "goose", "gemini"]
        if tokens.contains(where: { genericAgents.contains($0) }) {
            return "generic"
        }
        return nil
    }

    private func workingDirectory(for pid: Int32) -> String? {
        let output = runProcess("/usr/sbin/lsof", arguments: ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
        return output
            .split(separator: "\n")
            .map(String.init)
            .first(where: { $0.hasPrefix("n/") })
            .map { String($0.dropFirst()) }
    }

    private func runningTerminalApps() -> [Int32: (bundleID: String, name: String)] {
        let known: Set<String> = [
            "com.apple.Terminal",
            "com.googlecode.iterm2",
            "dev.warp.Warp-Stable",
            "com.mitchellh.ghostty",
            "net.kovidgoyal.kitty"
        ]

        var result: [Int32: (bundleID: String, name: String)] = [:]
        for app in NSWorkspace.shared.runningApplications {
            guard let bundleID = app.bundleIdentifier, known.contains(bundleID) else { continue }
            result[app.processIdentifier] = (bundleID, app.localizedName ?? "Terminal")
        }
        return result
    }

    private func sourceTerminal(
        for pid: Int32,
        parentByPID: [Int32: Int32],
        runningTerminals: [Int32: (bundleID: String, name: String)]
    ) -> (bundleID: String, name: String)? {
        var current = pid
        var visited = Set<Int32>()

        for _ in 0..<16 {
            guard visited.insert(current).inserted else { break }
            if let app = runningTerminals[current] {
                return app
            }
            guard let parent = parentByPID[current], parent > 1, parent != current else {
                break
            }
            current = parent
        }

        // Some terminal apps proxy shell processes through a helper. If exactly
        // one supported terminal is running, that is a safe app-level fallback.
        let unique = Array(runningTerminals.values)
        return unique.count == 1 ? unique[0] : nil
    }

    private func runProcess(_ executable: String, arguments: [String]) -> String {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = pipe
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(decoding: data, as: UTF8.self)
        } catch {
            return ""
        }
    }

    private var notchSignalApplicationSupport: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/NotchSignal", isDirectory: true)
    }

    private var claudeHookScriptURL: URL {
        notchSignalApplicationSupport
            .appendingPathComponent("hooks", isDirectory: true)
            .appendingPathComponent("claude-hook.sh", isDirectory: false)
    }

    private var claudeEventURL: URL {
        notchSignalApplicationSupport
            .appendingPathComponent("events", isDirectory: true)
            .appendingPathComponent("claude.tsv", isDirectory: false)
    }

    private var claudeSettingsURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".claude", isDirectory: true)
            .appendingPathComponent("settings.json", isDirectory: false)
    }

    private func isClaudeHookInstalled() -> Bool {
        guard let data = try? Data(contentsOf: claudeSettingsURL),
              let string = String(data: data, encoding: .utf8)
        else { return false }
        return string.contains("NotchSignal") && string.contains("claude-hook.sh")
    }

    private func readClaudeHookEvents() -> [[String: Any]] {
        guard let data = try? Data(contentsOf: claudeEventURL),
              let text = String(data: data, encoding: .utf8)
        else { return [] }

        return text
            .split(separator: "\n", omittingEmptySubsequences: true)
            .suffix(300)
            .compactMap { line in
                let fields = String(line).components(separatedBy: "\t")
                guard fields.count >= 7, let timestamp = Double(fields[0]) else { return nil }
                return [
                    "timestamp": timestamp,
                    "sessionID": fields[1],
                    "cwd": fields[2],
                    "event": fields[3],
                    "tool": fields[4],
                    "notificationType": fields[5],
                    "error": fields[6]
                ]
            }
    }

    private func installNotchSignalClaudeHooks() throws {
        let fm = FileManager.default
        try fm.createDirectory(
            at: claudeHookScriptURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try fm.createDirectory(
            at: claudeEventURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try fm.createDirectory(
            at: claudeSettingsURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        // The hook deliberately strips prompt text, source code, tool payloads,
        // and assistant output. Only minimal lifecycle metadata is persisted.
        let script = #"""
#!/bin/zsh
set -u
EVENT_DIR="$HOME/Library/Application Support/NotchSignal/events"
EVENT_FILE="$EVENT_DIR/claude.tsv"
mkdir -p "$EVENT_DIR"
INPUT="$(cat)"

value() {
  printf '%s' "$INPUT" \
    | /usr/bin/sed -n 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | /usr/bin/head -n 1 \
    | /usr/bin/tr '\t\r\n' '   '
}

TS="$(/bin/date +%s)"
SESSION="$(value session_id)"
CWD="$(value cwd)"
EVENT="$(value hook_event_name)"
TOOL="$(value tool_name)"
NOTICE="$(value notification_type)"
ERROR_KIND="$(value error)"

printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$TS" "$SESSION" "$CWD" "$EVENT" "$TOOL" "$NOTICE" "$ERROR_KIND" >> "$EVENT_FILE"

SIZE="$(/usr/bin/stat -f%z "$EVENT_FILE" 2>/dev/null || echo 0)"
if [[ "$SIZE" -gt 524288 ]]; then
  TMP="$EVENT_FILE.tmp"
  /usr/bin/tail -n 500 "$EVENT_FILE" > "$TMP"
  /bin/mv "$TMP" "$EVENT_FILE"
fi
exit 0
"""#

        try script.write(to: claudeHookScriptURL, atomically: true, encoding: .utf8)
        _ = chmod(claudeHookScriptURL.path, 0o755)

        var root: [String: Any] = [:]
        if fm.fileExists(atPath: claudeSettingsURL.path) {
            let existing = try Data(contentsOf: claudeSettingsURL)
            if !existing.isEmpty {
                guard let parsed = try JSONSerialization.jsonObject(with: existing) as? [String: Any] else {
                    throw NSError(
                        domain: "NotchSignal",
                        code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Claude settings.json is not a JSON object."]
                    )
                }
                root = parsed
            }

            let formatter = DateFormatter()
            formatter.dateFormat = "yyyyMMdd-HHmmss"
            let backup = claudeSettingsURL
                .deletingLastPathComponent()
                .appendingPathComponent("settings.notchsignal-backup-\(formatter.string(from: Date())).json")
            try? fm.copyItem(at: claudeSettingsURL, to: backup)
        }

        var hooks = root["hooks"] as? [String: Any] ?? [:]
        let command = "/bin/zsh \(shellQuote(claudeHookScriptURL.path))"
        let handler: [String: Any] = [
            "type": "command",
            "command": command,
            "timeout": 5
        ]
        let events = [
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PermissionRequest",
            "PostToolUse",
            "PostToolUseFailure",
            "Notification",
            "Stop",
            "StopFailure",
            "SessionEnd"
        ]

        for event in events {
            var groups = hooks[event] as? [[String: Any]] ?? []
            let alreadyInstalled = groups.contains { containsNotchSignalCommand($0) }
            if !alreadyInstalled {
                groups.append(["hooks": [handler]])
            }
            hooks[event] = groups
        }

        root["hooks"] = hooks
        let output = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
        try output.write(to: claudeSettingsURL, options: .atomic)
    }

    private func containsNotchSignalCommand(_ value: Any) -> Bool {
        if let string = value as? String {
            return string.contains("NotchSignal") && string.contains("claude-hook.sh")
        }
        if let dictionary = value as? [String: Any] {
            return dictionary.values.contains(where: containsNotchSignalCommand)
        }
        if let array = value as? [Any] {
            return array.contains(where: containsNotchSignalCommand)
        }
        return false
    }

    private func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    
    @objc func isAccessibilityAuthorized(with reply: @escaping (Bool) -> Void) {
        reply(AXIsProcessTrusted())
    }

    @objc func requestAccessibilityAuthorization() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        AXIsProcessTrustedWithOptions(options)
    }

    @objc func ensureAccessibilityAuthorization(_ promptIfNeeded: Bool, with reply: @escaping (Bool) -> Void) {
        if AXIsProcessTrusted() {
            reply(true)
            return
        }

        if promptIfNeeded {
            requestAccessibilityAuthorization()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            reply(AXIsProcessTrusted())
        }
    }
    
    private class KeyboardBrightnessClient {
        private static let keyboardID: UInt64 = 1
        private var clientInstance: NSObject?
        private let getSelector = NSSelectorFromString("brightnessForKeyboard:")
        private let setSelector = NSSelectorFromString("setBrightness:forKeyboard:")

        init() {
            var loaded = false
            let bundlePaths = [
                "/System/Library/PrivateFrameworks/CoreBrightness.framework",
                "/System/Library/PrivateFrameworks/CoreBrightness.framework/CoreBrightness"
            ]
            for path in bundlePaths where !loaded {
                if let bundle = Bundle(path: path) {
                    loaded = bundle.load()
                }
            }
            if loaded, let cls = NSClassFromString("KeyboardBrightnessClient") as? NSObject.Type {
                clientInstance = cls.init()
            }
        }

        var isAvailable: Bool { clientInstance != nil }

        func currentBrightness() -> Float? {
            guard let clientInstance,
                  let fn: BrightnessGetter = methodIMP(on: clientInstance, selector: getSelector, as: BrightnessGetter.self)
            else { return nil }
            return fn(clientInstance, getSelector, Self.keyboardID)
        }

        func setBrightness(_ value: Float) -> Bool {
            guard let clientInstance,
                  let fn: BrightnessSetter = methodIMP(on: clientInstance, selector: setSelector, as: BrightnessSetter.self)
            else { return false }
            return fn(clientInstance, setSelector, value, Self.keyboardID).boolValue
        }

        private typealias BrightnessGetter = @convention(c) (NSObject, Selector, UInt64) -> Float
        private typealias BrightnessSetter = @convention(c) (NSObject, Selector, Float, UInt64) -> ObjCBool

        private func methodIMP<T>(on object: NSObject, selector: Selector, as type: T.Type) -> T? {
            guard let cls = object_getClass(object),
                  let method = class_getInstanceMethod(cls, selector)
            else { return nil }
            let imp = method_getImplementation(method)
            return unsafeBitCast(imp, to: type)
        }
    }

    private static let keyboardClient = KeyboardBrightnessClient()

    @objc func isKeyboardBrightnessAvailable(with reply: @escaping (Bool) -> Void) {
        reply(Self.keyboardClient.isAvailable)
    }

    @objc func currentKeyboardBrightness(with reply: @escaping (NSNumber?) -> Void) {
        reply(Self.keyboardClient.currentBrightness().map { NSNumber(value: $0) })
    }

    @objc func setKeyboardBrightness(_ value: Float, with reply: @escaping (Bool) -> Void) {
        reply(Self.keyboardClient.setBrightness(value))
    }
    // MARK: - Screen Brightness (moved from client app into helper)

    @objc func isScreenBrightnessAvailable(with reply: @escaping (Bool) -> Void) {
        var b: Float = 0
        reply(displayServicesGetBrightness(displayID: CGMainDisplayID(), out: &b) || ioServiceFor(displayID: CGMainDisplayID()) != nil)
    }

    @objc func currentScreenBrightness(with reply: @escaping (NSNumber?) -> Void) {
        var b: Float = 0
        if displayServicesGetBrightness(displayID: CGMainDisplayID(), out: &b) {
            reply(NSNumber(value: b))
            return
        }
        if let io = ioServiceFor(displayID: CGMainDisplayID()) {
            var level: Float = 0
            if IODisplayGetFloatParameter(io, 0, kIODisplayBrightnessKey as CFString, &level) == kIOReturnSuccess {
                IOObjectRelease(io)
                reply(NSNumber(value: level))
                return
            }
            IOObjectRelease(io)
        }
        reply(nil)
    }

    @objc func setScreenBrightness(_ value: Float, with reply: @escaping (Bool) -> Void) {
        let clamped = max(0, min(1, value))
        if displayServicesSetBrightness(displayID: CGMainDisplayID(), value: clamped) {
            reply(true)
            return
        }
        if let io = ioServiceFor(displayID: CGMainDisplayID()) {
            let ok = IODisplaySetFloatParameter(io, 0, kIODisplayBrightnessKey as CFString, clamped) == kIOReturnSuccess
            IOObjectRelease(io)
            reply(ok)
            return
        }
        reply(false)
    }

    // MARK: - Private helpers for DisplayServices / IOKit access
    private func displayServicesGetBrightness(displayID: CGDirectDisplayID, out: inout Float) -> Bool {
        guard let sym = dlsym(DisplayServicesHandle.handle, "DisplayServicesGetBrightness") else { return false }
        typealias Fn = @convention(c) (CGDirectDisplayID, UnsafeMutablePointer<Float>) -> Int32
        let fn = unsafeBitCast(sym, to: Fn.self)
        var tmp: Float = 0
        let r = fn(displayID, &tmp)
        if r == 0 { out = tmp; return true }
        return false
    }

    private func displayServicesSetBrightness(displayID: CGDirectDisplayID, value: Float) -> Bool {
        guard let sym = dlsym(DisplayServicesHandle.handle, "DisplayServicesSetBrightness") else { return false }
        typealias Fn = @convention(c) (CGDirectDisplayID, Float) -> Int32
        let fn = unsafeBitCast(sym, to: Fn.self)
        return fn(displayID, value) == 0
    }

    private func ioServiceFor(displayID: CGDirectDisplayID) -> io_service_t? {
        var iterator: io_iterator_t = 0
        guard IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("IODisplayConnect"), &iterator) == kIOReturnSuccess else { return nil }
        defer { IOObjectRelease(iterator) }

        while case let service = IOIteratorNext(iterator), service != 0 {
            let info = IODisplayCreateInfoDictionary(service, 0).takeRetainedValue() as NSDictionary
            if let vendorID = info[kDisplayVendorID] as? UInt32,
               let productID = info[kDisplayProductID] as? UInt32,
               vendorID == CGDisplayVendorNumber(displayID),
               productID == CGDisplayModelNumber(displayID) {
                return service
            }
            IOObjectRelease(service)
        }
        return nil
    }

    // MARK: - Helper handle for private framework
    private enum DisplayServicesHandle {
        static let handle: UnsafeMutableRawPointer? = {
            let paths = [
                "/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices",
                "/System/Library/PrivateFrameworks/DisplayServices.framework/Versions/Current/DisplayServices"
            ]
            for p in paths {
                if let h = dlopen(p, RTLD_LAZY) { return h }
            }
            return nil
        }()
    }
}
