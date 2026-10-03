import AppKit
import Darwin

struct TintConfig: Decodable, Equatable {
    var enabled: Bool
    var target: String
    var base: String
    var maxAlpha: Double
    var radius: Double
}

struct ScreenWindow {
    let id: CGWindowID
    let pid: pid_t
    let layer: Int
    let alpha: Double
    let bounds: CGRect
    let owner: String
}

let helperDirectory = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".claude/clubhouse-helper", isDirectory: true)
let configURL = helperDirectory.appendingPathComponent("tint.json")
let lockPath = helperDirectory.appendingPathComponent("tint.lock").path
let targetBundleIDs = ["com.anthropic.claudefordesktop"]
let ticksPerSecond = 60.0
let idleTicksPerCheck = 6
let secondsHotAfterChange = 1.5
let smallestAlpha = 0.02
let secondsDisabledBeforeExit = 2.0
let secondsWithoutAppBeforeExit = 30.0
let smallestTarget = CGSize(width: 300, height: 200)
let smallestOccluder = CGSize(width: 40, height: 40)
let menuBarLayer = 24
let menuBarOverlapAllowed: CGFloat = 4

func screenWindows() -> [ScreenWindow] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let raw = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        return []
    }

    return raw.compactMap { info in
        guard let number = info[kCGWindowNumber as String] as? Int,
              let pid = info[kCGWindowOwnerPID as String] as? Int,
              let boundsInfo = info[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: boundsInfo as CFDictionary)
        else {
            return nil
        }

        return ScreenWindow(
            id: CGWindowID(number),
            pid: pid_t(pid),
            layer: info[kCGWindowLayer as String] as? Int ?? 0,
            alpha: info[kCGWindowAlpha as String] as? Double ?? 1,
            bounds: bounds,
            owner: info[kCGWindowOwnerName as String] as? String ?? ""
        )
    }
}

func displayComponents(hex: String) -> [Double] {
    let digits = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    let value = UInt32(digits, radix: 16) ?? 0x808080
    let color = NSColor(
        srgbRed: CGFloat((value >> 16) & 0xff) / 255,
        green: CGFloat((value >> 8) & 0xff) / 255,
        blue: CGFloat(value & 0xff) / 255,
        alpha: 1
    ).usingColorSpace(.displayP3)

    return [color?.redComponent, color?.greenComponent, color?.blueComponent].map { Double($0 ?? 0.5) }
}

func layerColor(over base: [Double], toReach target: [Double], maxAlpha: Double) -> CGColor {
    let needed = zip(base, target).map { from, to in
        to >= from ? (to - from) / max(1 - from, 0.0001) : (from - to) / max(from, 0.0001)
    }
    let alpha = min(max(needed.max() ?? 0, smallestAlpha), maxAlpha)
    let components = zip(base, target).map { from, to in
        CGFloat(min(max((to - from * (1 - alpha)) / alpha, 0), 1))
    }
    let space = CGColorSpace(name: CGColorSpace.displayP3) ?? CGColorSpaceCreateDeviceRGB()

    return CGColor(colorSpace: space, components: components + [CGFloat(alpha)])
        ?? NSColor.clear.cgColor
}

func tintPath(target: CGRect, occluders: [CGRect], radius: CGFloat) -> CGPath {
    let local = CGRect(origin: .zero, size: target.size)
    let corner = min(radius, local.width / 2, local.height / 2)
    var path = CGPath(roundedRect: local, cornerWidth: corner, cornerHeight: corner, transform: nil)

    for occluder in occluders {
        let overlap = occluder.intersection(target)

        if overlap.isNull || overlap.isEmpty {
            continue
        }

        let hole = CGRect(
            x: overlap.minX - target.minX,
            y: target.maxY - overlap.maxY,
            width: overlap.width,
            height: overlap.height
        )
        path = path.subtracting(CGPath(rect: hole, transform: nil))
    }

    return path
}

final class Tinter {
    private var config: TintConfig?
    private var configStamp: Date?
    private var overlays: [CGWindowID: NSWindow] = [:]
    private var shapes: [CGWindowID: CAShapeLayer] = [:]
    private var disabledSince: Date?
    private var appMissingSince: Date?
    private var tickCount = 0
    private var hotUntil = Date.distantPast
    private var lastLayout = ""
    private let ownPid = ProcessInfo.processInfo.processIdentifier

    func start() {
        Timer.scheduledTimer(withTimeInterval: 1 / ticksPerSecond, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func reloadConfig() {
        let stamp = (try? FileManager.default.attributesOfItem(atPath: configURL.path))?[.modificationDate] as? Date

        if stamp == configStamp, config != nil || stamp == nil {
            return
        }

        configStamp = stamp
        config = (try? Data(contentsOf: configURL)).flatMap { try? JSONDecoder().decode(TintConfig.self, from: $0) }
    }

    private func exitWhenIdle(since: inout Date?, limit: Double) {
        let started = since ?? Date()
        since = started

        if Date().timeIntervalSince(started) > limit {
            exit(0)
        }
    }

    private func removeOverlays(except kept: Set<CGWindowID>) {
        for (id, window) in overlays where !kept.contains(id) {
            window.orderOut(nil)
            overlays[id] = nil
            shapes[id] = nil
        }
    }

    private func overlay(for id: CGWindowID, frame: NSRect) -> (NSWindow, CAShapeLayer) {
        if let window = overlays[id], let shape = shapes[id] {
            return (window, shape)
        }

        let window = NSWindow(contentRect: frame, styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle, .fullScreenAuxiliary]
        window.isReleasedWhenClosed = false
        window.animationBehavior = .none

        let view = NSView(frame: NSRect(origin: .zero, size: frame.size))
        view.wantsLayer = true
        let shape = CAShapeLayer()
        view.layer?.addSublayer(shape)
        window.contentView = view
        overlays[id] = window
        shapes[id] = shape

        return (window, shape)
    }

    private func tick() {
        tickCount += 1

        if Date() > hotUntil, tickCount % idleTicksPerCheck != 0 {
            return
        }

        reloadConfig()

        guard let config, config.enabled else {
            removeOverlays(except: [])
            exitWhenIdle(since: &disabledSince, limit: secondsDisabledBeforeExit)
            return
        }

        disabledSince = nil
        let pids = Set(
            targetBundleIDs
                .flatMap { NSRunningApplication.runningApplications(withBundleIdentifier: $0) }
                .map(\.processIdentifier)
        )

        if pids.isEmpty {
            removeOverlays(except: [])
            exitWhenIdle(since: &appMissingSince, limit: secondsWithoutAppBeforeExit)
            return
        }

        appMissingSince = nil
        let mainHeight = NSScreen.screens.first?.frame.height ?? 0
        let color = layerColor(
            over: displayComponents(hex: config.base),
            toReach: displayComponents(hex: config.target),
            maxAlpha: config.maxAlpha
        )
        var layout = "\(config)"
        let onScreen = screenWindows()
        let menuBars = onScreen.filter { $0.layer == menuBarLayer }.map(\.bounds)
        var occluders: [CGRect] = []
        var covered: [CGRect] = []
        var kept = Set<CGWindowID>()

        CATransaction.begin()
        CATransaction.setDisableActions(true)

        for candidate in onScreen where candidate.pid != ownPid && candidate.layer == 0 && candidate.alpha > 0.01 {
            let size = candidate.bounds.size
            let coversMenuBar = menuBars.contains { $0.intersection(candidate.bounds).height > menuBarOverlapAllowed }

            if coversMenuBar {
                continue
            }

            if pids.contains(candidate.pid),
               size.width >= smallestTarget.width,
               size.height >= smallestTarget.height,
               !covered.contains(candidate.bounds) {
                covered.append(candidate.bounds)
                let frame = NSRect(
                    x: candidate.bounds.minX,
                    y: mainHeight - candidate.bounds.maxY,
                    width: size.width,
                    height: size.height
                )
                let (window, shape) = overlay(for: candidate.id, frame: frame)

                if window.frame != frame {
                    window.setFrame(frame, display: true)
                }

                shape.frame = CGRect(origin: .zero, size: size)
                shape.fillColor = color
                shape.path = tintPath(target: candidate.bounds, occluders: occluders, radius: CGFloat(config.radius))

                if !window.isVisible {
                    window.orderFrontRegardless()
                }

                kept.insert(candidate.id)
                layout += "|\(candidate.id):\(candidate.bounds):\(occluders)"
            }

            if size.width >= smallestOccluder.width, size.height >= smallestOccluder.height {
                occluders.append(candidate.bounds)
            }
        }

        CATransaction.commit()
        removeOverlays(except: kept)

        if layout != lastLayout {
            lastLayout = layout
            hotUntil = Date().addingTimeInterval(secondsHotAfterChange)
        }
    }
}

if CommandLine.arguments.contains("--list") {
    for window in screenWindows() {
        let bounds = window.bounds
        print("\(window.id)\t\(window.pid)\tlayer \(window.layer)\t\(Int(bounds.minX)),\(Int(bounds.minY)) \(Int(bounds.width))x\(Int(bounds.height))\t\(window.owner)")
    }

    exit(0)
}

let lock = open(lockPath, O_CREAT | O_RDWR, 0o644)

if lock < 0 || flock(lock, LOCK_EX | LOCK_NB) != 0 {
    exit(0)
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let tinter = Tinter()
tinter.start()
application.run()
