import AppKit
import Foundation

enum AgentRunState: String, Codable, CaseIterable {
    case working
    case waiting
    case needsAttention
    case finished
    case failed
    case paused

    var title: String {
        switch self {
        case .working: "Working"
        case .waiting: "Waiting"
        case .needsAttention: "Needs attention"
        case .finished: "Finished"
        case .failed: "Failed"
        case .paused: "Paused"
        }
    }

    var symbolName: String {
        switch self {
        case .working: "circle.dotted"
        case .waiting: "pause.circle.fill"
        case .needsAttention: "exclamationmark.circle.fill"
        case .finished: "checkmark.circle.fill"
        case .failed: "xmark.circle.fill"
        case .paused: "pause.fill"
        }
    }
}

struct AgentSession: Identifiable, Hashable {
    let id: String
    let providerID: String
    let agentName: String
    let status: AgentRunState
    let statusDetail: String
    let startedAt: Date
    let lastActivity: Date
    let sourceBundleID: String?
    let sourceApp: String
    let workspacePath: String?
    let workspaceName: String
    let tty: String?
    let processID: Int32?

    var elapsed: TimeInterval {
        max(0, Date().timeIntervalSince(startedAt))
    }
}

struct AgentRuntimeSnapshot: Decodable {
    struct ProcessRecord: Decodable {
        let pid: Int32
        let kind: String
        let elapsedSeconds: Double
        let cwd: String?
        let workspaceName: String?
        let tty: String?
        let sourceBundleID: String?
        let sourceApp: String?
    }

    struct ClaudeEvent: Decodable {
        let timestamp: Double
        let sessionID: String
        let cwd: String
        let event: String
        let tool: String
        let notificationType: String
        let error: String
    }

    let generatedAt: Double
    let claudeHookInstalled: Bool
    let processes: [ProcessRecord]
    let claudeEvents: [ClaudeEvent]
}

protocol AgentProvider {
    var id: String { get }
    var displayName: String { get }

    func detectSessions(in snapshot: AgentRuntimeSnapshot) -> [AgentSession]
    func openSession(_ session: AgentSession)
}

struct ClaudeCodeProvider: AgentProvider {
    let id = "claude-code"
    let displayName = "Claude Code"

    func detectSessions(in snapshot: AgentRuntimeSnapshot) -> [AgentSession] {
        let processes = snapshot.processes.filter { $0.kind == "claude" }
        let now = Date()

        var sessions = processes.map { process -> AgentSession in
            let relevant = snapshot.claudeEvents
                .filter { event in
                    guard let cwd = process.cwd, !cwd.isEmpty else { return false }
                    return event.cwd == cwd
                }
                .sorted { $0.timestamp < $1.timestamp }

            let latest = relevant.last
            let sessionID = latest?.sessionID.isEmpty == false
                ? latest!.sessionID
                : "claude-pid-\(process.pid)"
            let sameSession = relevant.filter { $0.sessionID == sessionID }
            let startTimestamp = sameSession.first(where: { $0.event == "SessionStart" })?.timestamp
            let startedAt = startTimestamp.map(Date.init(timeIntervalSince1970:))
                ?? now.addingTimeInterval(-process.elapsedSeconds)
            let state = state(for: latest)
            let lastActivity = latest.map { Date(timeIntervalSince1970: $0.timestamp) } ?? now

            return AgentSession(
                id: "claude-\(sessionID)",
                providerID: id,
                agentName: displayName,
                status: state.0,
                statusDetail: state.1,
                startedAt: startedAt,
                lastActivity: lastActivity,
                sourceBundleID: process.sourceBundleID,
                sourceApp: process.sourceApp ?? "Terminal",
                workspacePath: process.cwd,
                workspaceName: process.workspaceName ?? workspaceName(from: process.cwd),
                tty: process.tty,
                processID: process.pid
            )
        }

        // A SessionEnd/agent_completed hook can arrive just after the process exits.
        // Surface it briefly so completion is visible without fabricating a running process.
        let liveIDs = Set(sessions.map(\.id))
        let recentTerminalEvents = Dictionary(grouping: snapshot.claudeEvents, by: \.sessionID)
            .compactMap { sessionID, events -> AgentSession? in
                guard !sessionID.isEmpty,
                      let latest = events.max(by: { $0.timestamp < $1.timestamp }),
                      Date().timeIntervalSince1970 - latest.timestamp < 12
                else { return nil }

                let mapped = state(for: latest)
                guard mapped.0 == .finished || mapped.0 == .failed else { return nil }

                let id = "claude-\(sessionID)"
                guard !liveIDs.contains(id) else { return nil }
                let started = events
                    .first(where: { $0.event == "SessionStart" })
                    .map { Date(timeIntervalSince1970: $0.timestamp) }
                    ?? Date(timeIntervalSince1970: latest.timestamp)

                return AgentSession(
                    id: id,
                    providerID: self.id,
                    agentName: self.displayName,
                    status: mapped.0,
                    statusDetail: mapped.1,
                    startedAt: started,
                    lastActivity: Date(timeIntervalSince1970: latest.timestamp),
                    sourceBundleID: nil,
                    sourceApp: "Terminal",
                    workspacePath: latest.cwd,
                    workspaceName: workspaceName(from: latest.cwd),
                    tty: nil,
                    processID: nil
                )
            }

        sessions.append(contentsOf: recentTerminalEvents)
        return sessions
    }

    func openSession(_ session: AgentSession) {
        AgentJumpBack.open(session)
    }

    private func state(for event: AgentRuntimeSnapshot.ClaudeEvent?) -> (AgentRunState, String) {
        guard let event else { return (.working, "Process running") }

        switch event.event {
        case "PermissionRequest":
            return (.needsAttention, "Waiting for permission")
        case "Notification":
            switch event.notificationType {
            case "permission_prompt", "agent_needs_input":
                return (.needsAttention, "Waiting for you")
            case "agent_completed":
                return (.finished, "Completed")
            case "idle_prompt":
                return (.waiting, "Waiting for input")
            default:
                return (.waiting, "Notification")
            }
        case "Stop":
            return (.waiting, "Waiting for input")
        case "StopFailure":
            return (.failed, event.error.isEmpty ? "Agent stopped with an error" : event.error)
        case "SessionEnd":
            return (.finished, "Session ended")
        case "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "SessionStart":
            return (.working, event.tool.isEmpty ? "Working" : "Using \(event.tool)")
        default:
            return (.working, "Working")
        }
    }
}

struct CodexProvider: AgentProvider {
    let id = "codex"
    let displayName = "Codex"

    func detectSessions(in snapshot: AgentRuntimeSnapshot) -> [AgentSession] {
        let now = Date()
        return snapshot.processes
            .filter { $0.kind == "codex" }
            .map { process in
                AgentSession(
                    id: "codex-pid-\(process.pid)",
                    providerID: id,
                    agentName: displayName,
                    status: .working,
                    statusDetail: "Process running",
                    startedAt: now.addingTimeInterval(-process.elapsedSeconds),
                    lastActivity: now,
                    sourceBundleID: process.sourceBundleID,
                    sourceApp: process.sourceApp ?? "Terminal",
                    workspacePath: process.cwd,
                    workspaceName: process.workspaceName ?? workspaceName(from: process.cwd),
                    tty: process.tty,
                    processID: process.pid
                )
            }
    }

    func openSession(_ session: AgentSession) {
        AgentJumpBack.open(session)
    }
}

struct TerminalAgentProvider: AgentProvider {
    let id = "terminal-agent"
    let displayName = "Terminal agent"

    func detectSessions(in snapshot: AgentRuntimeSnapshot) -> [AgentSession] {
        let now = Date()
        return snapshot.processes
            .filter { $0.kind == "generic" }
            .map { process in
                AgentSession(
                    id: "terminal-pid-\(process.pid)",
                    providerID: id,
                    agentName: process.sourceApp ?? displayName,
                    status: .working,
                    statusDetail: "Process running",
                    startedAt: now.addingTimeInterval(-process.elapsedSeconds),
                    lastActivity: now,
                    sourceBundleID: process.sourceBundleID,
                    sourceApp: process.sourceApp ?? "Terminal",
                    workspacePath: process.cwd,
                    workspaceName: process.workspaceName ?? workspaceName(from: process.cwd),
                    tty: process.tty,
                    processID: process.pid
                )
            }
    }

    func openSession(_ session: AgentSession) {
        AgentJumpBack.open(session)
    }
}

private func workspaceName(from path: String?) -> String {
    guard let path, !path.isEmpty else { return "Workspace" }
    return URL(fileURLWithPath: path).lastPathComponent
}

enum AgentJumpBack {
    @MainActor
    static func open(_ session: AgentSession) {
        if let tty = session.tty, !tty.isEmpty, tryTerminalTTY(tty) {
            return
        }

        if let bundleID = session.sourceBundleID,
           let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first {
            app.activate(options: [.activateAllWindows])
            return
        }

        let terminalBundleIDs = [
            "com.apple.Terminal",
            "com.googlecode.iterm2",
            "dev.warp.Warp-Stable",
            "com.mitchellh.ghostty"
        ]
        for bundleID in terminalBundleIDs {
            if let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first {
                app.activate(options: [.activateAllWindows])
                return
            }
        }
    }

    @MainActor
    private static func tryTerminalTTY(_ tty: String) -> Bool {
        guard !NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Terminal").isEmpty else {
            return false
        }

        let safeTTY = tty
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let source = """
        tell application "Terminal"
            repeat with w in windows
                repeat with t in tabs of w
                    if (tty of t) is "\(safeTTY)" then
                        set selected tab of w to t
                        set index of w to 1
                        activate
                        return true
                    end if
                end repeat
            end repeat
        end tell
        return false
        """

        var error: NSDictionary?
        guard let result = NSAppleScript(source: source)?.executeAndReturnError(&error) else {
            return false
        }
        return result.booleanValue
    }
}
