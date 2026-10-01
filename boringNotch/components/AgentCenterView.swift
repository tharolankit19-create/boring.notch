import SwiftUI
import UserNotifications

struct AgentCenterView: View {
    @ObservedObject private var monitor = AgentMonitor.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 10) {
            header

            if monitor.sessions.isEmpty {
                emptyState
            } else {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 6) {
                        ForEach(monitor.sessions.prefix(4)) { session in
                            AgentSessionRow(session: session)
                        }
                    }
                }
                .frame(maxHeight: 142)
            }

            footer
        }
        .frame(minWidth: 500, idealWidth: 540)
        .animation(reduceMotion ? nil : .snappy(duration: 0.24), value: monitor.sessions)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "waveform.path.ecg")
                .font(.system(size: 13, weight: .semibold))
            Text("Agents")
                .font(.system(size: 14, weight: .semibold))
            Text("\(monitor.sessions.filter { $0.status != .finished }.count) active")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)

            Spacer()

            AgentPreferencesMenu()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("AI agent activity")
    }

    private var emptyState: some View {
        VStack(spacing: 7) {
            Image(systemName: "terminal")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(.secondary)
            Text("No agents running")
                .font(.system(size: 13, weight: .semibold))
            Text(monitor.claudeHookInstalled
                 ? "Start Claude Code or Codex. NotchSignal will pick it up locally."
                 : "Start Claude Code or Codex, or enable Claude attention signals.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if !monitor.claudeHookInstalled {
                Button("Enable Claude attention") {
                    Task { await monitor.installClaudeHooks() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityHint("Adds local Claude Code lifecycle hooks without storing prompts or source code")
            }

            if let error = monitor.lastError {
                Text(error)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 112)
    }

    private var footer: some View {
        HStack(spacing: 12) {
            Label("\(monitor.sessionsToday) today", systemImage: "clock")
            Label("\(monitor.completedToday) done", systemImage: "checkmark")
            if monitor.failedToday > 0 {
                Label("\(monitor.failedToday) failed", systemImage: "xmark")
            }
            Spacer()
            Text(formatDuration(monitor.totalRuntimeToday))
                .foregroundStyle(.secondary)
        }
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds) / 60
        if minutes < 60 { return "\(minutes)m runtime" }
        return "\(minutes / 60)h \(minutes % 60)m runtime"
    }
}

private struct AgentSessionRow: View {
    @ObservedObject private var monitor = AgentMonitor.shared
    let session: AgentSession

    var body: some View {
        HStack(spacing: 10) {
            statusMark
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(session.agentName)
                        .font(.system(size: 12, weight: .semibold))
                    Text(session.workspaceName)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                HStack(spacing: 5) {
                    Text(session.status.title)
                        .fontWeight(.medium)
                    Text("·")
                    Text(session.statusDetail)
                        .lineLimit(1)
                    if session.status != .finished && session.status != .failed {
                        Text("·")
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            Text(session.startedAt, style: .timer)
                                .monospacedDigit()
                        }
                    }
                }
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            if session.status != .finished {
                Button("Open") {
                    monitor.open(session)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityLabel("Open \(session.agentName) in \(session.sourceApp)")
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var statusMark: some View {
        Image(systemName: session.status.symbolName)
            .font(.system(size: 13, weight: .semibold))
            .symbolEffect(.pulse, isActive: session.status == .working)
            .foregroundStyle(statusColor)
            .accessibilityLabel(session.status.title)
    }

    private var statusColor: Color {
        switch session.status {
        case .working: .blue
        case .waiting: .yellow
        case .needsAttention: .orange
        case .finished: .green
        case .failed: .red
        case .paused: .secondary
        }
    }
}

struct AgentCompactView: View {
    let session: AgentSession
    let notchWidth: CGFloat

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: session.status.symbolName)
                    .font(.system(size: 10, weight: .semibold))
                Text(session.agentName)
                    .lineLimit(1)
            }
            .frame(width: 118, alignment: .trailing)

            Rectangle()
                .fill(.black)
                .frame(width: max(80, notchWidth - 32), height: 1)

            Text(session.status.title)
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
                .frame(width: 118, alignment: .leading)
        }
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.white)
        .frame(height: 30)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(session.agentName), \(session.status.title), \(session.workspaceName)")
    }
}

struct AgentPreferencesMenu: View {
    @AppStorage("notchsignal.autoExpandAttention") private var autoExpand = true
    @AppStorage("notchsignal.soundAttention") private var soundAttention = false
    @AppStorage("notchsignal.systemNotifications") private var systemNotifications = false
    @AppStorage("notchsignal.doNotDisturb") private var doNotDisturb = false
    @AppStorage("notchsignal.keepAwakeAgents") private var keepAwake = false

    var body: some View {
        Menu {
            Toggle("Auto-expand for attention", isOn: $autoExpand)
            Toggle("Attention sound", isOn: $soundAttention)
            Toggle("System notifications", isOn: $systemNotifications)
                .onChange(of: systemNotifications) { _, enabled in
                    guard enabled else { return }
                    UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { granted, _ in
                        if !granted {
                            DispatchQueue.main.async {
                                systemNotifications = false
                            }
                        }
                    }
                }
            Toggle("Do Not Disturb", isOn: $doNotDisturb)
            Divider()
            Toggle("Keep Mac awake while agents work", isOn: $keepAwake)
                .onChange(of: keepAwake) { _, _ in
                    AgentMonitor.shared.refreshNow()
                }
        } label: {
            Image(systemName: "slider.horizontal.3")
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 24, height: 20)
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Agent preferences")
    }
}
