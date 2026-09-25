import AppKit
import Foundation
import UserNotifications

struct AgentHistoryItem: Identifiable, Codable, Hashable {
    let id: String
    let agentName: String
    let workspaceName: String
    let status: AgentRunState
    let startedAt: Date
    let finishedAt: Date

    var duration: TimeInterval {
        max(0, finishedAt.timeIntervalSince(startedAt))
    }
}

extension Notification.Name {
    static let notchSignalNeedsAttention = Notification.Name("notchSignalNeedsAttention")
}

final class AgentMonitor: ObservableObject {
    static let shared = AgentMonitor()

    @Published private(set) var sessions: [AgentSession] = []
    @Published private(set) var history: [AgentHistoryItem] = []
    @Published private(set) var claudeHookInstalled = false
    @Published private(set) var lastError: String?

    private let providers: [any AgentProvider] = [
        ClaudeCodeProvider(),
        CodexProvider(),
        TerminalAgentProvider()
    ]

    private var refreshTask: Task<Void, Never>?
    private var sleepActivity: NSObjectProtocol?
    private var recordedHistoryIDs = Set<String>()

    private let historyKey = "notchsignal.agentHistory"

    private init() {
        UserDefaults.standard.register(defaults: [
            "notchsignal.autoExpandAttention": true,
            "notchsignal.soundAttention": false,
            "notchsignal.systemNotifications": false,
            "notchsignal.doNotDisturb": false,
            "notchsignal.keepAwakeAgents": false
        ])
        loadHistory()
        start()
    }

    deinit {
        refreshTask?.cancel()
        endSleepActivity()
    }

    var prioritySession: AgentSession? {
        sessions.sorted(by: prioritySort).first
    }

    var sessionsToday: Int {
        historyToday.count + sessions.filter { Calendar.current.isDateInToday($0.startedAt) }.count
    }

    var completedToday: Int {
        historyToday.filter { $0.status == .finished }.count
    }

    var failedToday: Int {
        historyToday.filter { $0.status == .failed }.count
    }

    var totalRuntimeToday: TimeInterval {
        historyToday.reduce(0) { $0 + $1.duration }
            + sessions.filter { Calendar.current.isDateInToday($0.startedAt) }.reduce(0) { $0 + $1.elapsed }
    }

    var historyToday: [AgentHistoryItem] {
        history.filter { Calendar.current.isDateInToday($0.finishedAt) }
    }

    func provider(for session: AgentSession) -> (any AgentProvider)? {
        providers.first { $0.id == session.providerID }
    }

    func open(_ session: AgentSession) {
        provider(for: session)?.openSession(session)
    }

    func refreshNow() {
        Task { await refresh() }
    }

    func installClaudeHooks() async {
        let result = await XPCHelperClient.shared.installClaudeHooks()
        await MainActor.run {
            if result.success {
                self.lastError = nil
            } else {
                self.lastError = result.error ?? "Could not enable Claude Code hooks."
            }
        }
        await refresh()
    }

    private func start() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                do {
                    try await Task.sleep(for: .seconds(5))
                } catch {
                    break
                }
            }
        }
    }

    private func refresh() async {
        guard let data = await XPCHelperClient.shared.agentSnapshot() else {
            await MainActor.run {
                self.lastError = "Agent helper is unavailable."
            }
            return
        }

        do {
            let snapshot = try JSONDecoder().decode(AgentRuntimeSnapshot.self, from: data)
            var detected = providers.flatMap { $0.detectSessions(in: snapshot) }
            detected.sort(by: prioritySort)

            await MainActor.run {
                self.lastError = nil
                self.claudeHookInstalled = snapshot.claudeHookInstalled
                self.apply(detected)
            }
        } catch {
            await MainActor.run {
                self.lastError = "Could not read local agent state."
            }
        }
    }

    @MainActor
    private func apply(_ detected: [AgentSession]) {
        let previousByID = Dictionary(uniqueKeysWithValues: sessions.map { ($0.id, $0) })
        let detectedIDs = Set(detected.map(\.id))
        var next = detected

        for session in detected {
            if let previous = previousByID[session.id],
               previous.status != session.status {
                handleTransition(from: previous.status, to: session)
            }

            if session.status == .finished || session.status == .failed {
                recordHistory(session)
            }
        }

        // If a process vanishes without an explicit provider completion event,
        // record the disappearance as finished, but do not pretend it was a provider-reported success.
        for previous in sessions where !detectedIDs.contains(previous.id) {
            guard previous.status == .working || previous.status == .waiting || previous.status == .needsAttention else {
                continue
            }
            let finished = AgentSession(
                id: previous.id,
                providerID: previous.providerID,
                agentName: previous.agentName,
                status: .finished,
                statusDetail: "Process ended",
                startedAt: previous.startedAt,
                lastActivity: Date(),
                sourceBundleID: previous.sourceBundleID,
                sourceApp: previous.sourceApp,
                workspacePath: previous.workspacePath,
                workspaceName: previous.workspaceName,
                tty: previous.tty,
                processID: nil
            )
            next.append(finished)
            recordHistory(finished)
        }

        sessions = next.sorted(by: prioritySort)
        updateSleepActivity()
    }

    @MainActor
    private func handleTransition(from old: AgentRunState, to session: AgentSession) {
        guard session.status == .needsAttention, old != .needsAttention else { return }
        guard !UserDefaults.standard.bool(forKey: "notchsignal.doNotDisturb") else { return }

        NotificationCenter.default.post(name: .notchSignalNeedsAttention, object: session)

        if UserDefaults.standard.bool(forKey: "notchsignal.soundAttention") {
            NSSound(named: NSSound.Name("Ping"))?.play()
        }

        if UserDefaults.standard.bool(forKey: "notchsignal.systemNotifications") {
            let content = UNMutableNotificationContent()
            content.title = "\(session.agentName) needs you"
            content.body = "\(session.workspaceName) · \(session.statusDetail)"
            content.sound = nil
            let request = UNNotificationRequest(
                identifier: "notchsignal-\(session.id)-\(Int(Date().timeIntervalSince1970))",
                content: content,
                trigger: nil
            )
            UNUserNotificationCenter.current().add(request)
        }
    }

    @MainActor
    private func recordHistory(_ session: AgentSession) {
        guard !recordedHistoryIDs.contains(session.id) else { return }
        recordedHistoryIDs.insert(session.id)

        let item = AgentHistoryItem(
            id: "\(session.id)-\(Int(Date().timeIntervalSince1970))",
            agentName: session.agentName,
            workspaceName: session.workspaceName,
            status: session.status == .failed ? .failed : .finished,
            startedAt: session.startedAt,
            finishedAt: Date()
        )
        history.insert(item, at: 0)
        history = Array(history.prefix(100))
        persistHistory()
    }

    @MainActor
    private func updateSleepActivity() {
        let shouldKeepAwake = UserDefaults.standard.bool(forKey: "notchsignal.keepAwakeAgents")
            && sessions.contains { $0.status == .working }

        if shouldKeepAwake && sleepActivity == nil {
            sleepActivity = ProcessInfo.processInfo.beginActivity(
                options: [.idleSystemSleepDisabled],
                reason: "NotchSignal is keeping the Mac awake while selected AI work is running."
            )
        } else if !shouldKeepAwake {
            endSleepActivity()
        }
    }

    private func endSleepActivity() {
        if let sleepActivity {
            ProcessInfo.processInfo.endActivity(sleepActivity)
            self.sleepActivity = nil
        }
    }

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: historyKey),
              let decoded = try? JSONDecoder().decode([AgentHistoryItem].self, from: data)
        else { return }
        history = decoded
    }

    private func persistHistory() {
        guard let data = try? JSONEncoder().encode(history) else { return }
        UserDefaults.standard.set(data, forKey: historyKey)
    }

    private func prioritySort(_ lhs: AgentSession, _ rhs: AgentSession) -> Bool {
        let rank: [AgentRunState: Int] = [
            .needsAttention: 0,
            .failed: 1,
            .working: 2,
            .waiting: 3,
            .finished: 4,
            .paused: 5
        ]
        let left = rank[lhs.status, default: 99]
        let right = rank[rhs.status, default: 99]
        if left != right { return left < right }
        return lhs.lastActivity > rhs.lastActivity
    }
}
