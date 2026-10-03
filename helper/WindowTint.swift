import AppKit
import Darwin

struct TintConfig: Decodable, Equatable {
    var enabled: Bool
    var target: String
    var radius: Double
    var isLightApp: Bool?
    var ink: String?
    var boost: Double?
    var coverSidebar: Bool?
}

struct SidebarLayout: Equatable {
    var width: CGFloat
    var isCollapsed: Bool
}

struct AppLayout: Equatable {
    var sidebar: SidebarLayout?
    var themeMode: String?
}

struct ScreenWindow {
    let id: CGWindowID
    let pid: pid_t
    let layer: Int
    let alpha: Double
    let bounds: CGRect
    let owner: String
}

struct Overlay {
    let window: NSWindow
    let layers: [CALayer]
    let masks: [CAShapeLayer]
}

let helperDirectory = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".claude/clubhouse-helper", isDirectory: true)
let configURL = helperDirectory.appendingPathComponent("tint.json")
let lockPath = helperDirectory.appendingPathComponent("tint.lock").path
let logURL = helperDirectory.appendingPathComponent("tint.log")
let largestLog = 200_000
let tallestMenuBar: CGFloat = 60
let appLayoutURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Claude/config.json")
let narrowestWindowWithSidebar: CGFloat = 700
let targetBundleIDs = ["com.anthropic.claudefordesktop"]
let ticksPerSecond = 60.0
let idleTicksPerCheck = 6
let secondsHotAfterChange = 1.5
let secondsDisabledBeforeExit = 2.0
let secondsWithoutAppBeforeExit = 30.0
let smallestTarget = CGSize(width: 300, height: 200)
let smallestOccluder = CGSize(width: 40, height: 40)
let menuBarLayer = 24
let menuBarOverlapAllowed: CGFloat = 4
let darkSurfaceLimit = 34.5 / 255
let lightSurfaceLimit = 226.0 / 255
let keyFade = 10.0 / 255
let defaultBoost = 1.9
let filterStages = 3
let lumaWeights = [0.2126, 0.7152, 0.0722]
let lightInk = "#faf9f5"
let darkInk = "#141413"
let luminanceWhereDarkInkWins = 0.22
let fallbackAlpha: CGFloat = 0.3

func note(_ text: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(text)\n"
    let size = (try? FileManager.default.attributesOfItem(atPath: logURL.path))?[.size] as? Int ?? 0

    if size > largestLog || size == 0 {
        try? line.write(to: logURL, atomically: true, encoding: .utf8)
        return
    }

    if let handle = try? FileHandle(forWritingTo: logURL) {
        handle.seekToEndOfFile()
        handle.write(line.data(using: .utf8) ?? Data())
        try? handle.close()
    }
}

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

func appLayout() -> AppLayout {
    guard let data = try? Data(contentsOf: appLayoutURL),
          let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
        return AppLayout(sidebar: nil, themeMode: nil)
    }

    let frame = root["bootFrameLayout"] as? [String: Any]
    let sidebar = (frame?["sidebarWidth"] as? Double).map {
        SidebarLayout(width: CGFloat($0), isCollapsed: frame?["collapsed"] as? Bool ?? false)
    }

    return AppLayout(sidebar: sidebar, themeMode: root["userThemeMode"] as? String)
}

func systemIsDark() -> Bool {
    NSApplication.shared.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
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

func relativeLuminance(hex: String) -> Double {
    let digits = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    let value = UInt32(digits, radix: 16) ?? 0x808080
    let channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map { Double($0) / 255 }
    let linear = channels.map { $0 <= 0.03928 ? $0 / 12.92 : pow(($0 + 0.055) / 1.055, 2.4) }

    return zip(lumaWeights, linear).map(*).reduce(0, +)
}

func matrixFilter(_ matrix: [Float]) -> NSObject? {
    guard let filterClass = NSClassFromString("CAFilter") as? NSObject.Type,
          let filter = filterClass.perform(NSSelectorFromString("filterWithType:"), with: "colorMatrix")?
              .takeUnretainedValue() as? NSObject
    else {
        return nil
    }

    let boxed = matrix.withUnsafeBytes {
        NSValue(bytes: $0.baseAddress!, objCType: "{CAColorMatrix=ffffffffffffffffffff}")
    }
    filter.setValue(boxed, forKey: "inputColorMatrix")

    return filter
}

func sessionFilters(config: TintConfig, isLightApp: Bool) -> [NSObject]? {
    let target = displayComponents(hex: config.target)
    let inkHex = config.ink ?? (relativeLuminance(hex: config.target) > luminanceWhereDarkInkWins ? darkInk : lightInk)
    let toInk = zip(displayComponents(hex: inkHex), target).map { $0 - $1 }
    let anchor = isLightApp ? lightSurfaceLimit : darkSurfaceLimit
    let span = isLightApp ? anchor : 1 - anchor
    let reach = (isLightApp ? -1.0 : 1.0) / span
    let boost = max(config.boost ?? defaultBoost, 0)
    let length = max(toInk.map { $0 * $0 }.reduce(0, +), 0.0001)
    let along = toInk.map { $0 / length }
    let targetAlong = zip(target, along).map(*).reduce(0, +)
    let edge = keyFade / span
    let fade = edge + min(1, boost * edge) * (1 - edge)
    var lift = [Float](repeating: 0, count: 20)
    var remap = [Float](repeating: 0, count: 20)
    var key = [Float](repeating: 0, count: 20)

    for channel in 0..<3 {
        for source in 0..<3 {
            lift[channel * 5 + source] = Float((source == channel ? 1 : 0) - lumaWeights[source])
            remap[channel * 5 + source] = Float(
                (source == channel ? 1 : 0) + lumaWeights[source] * (reach * toInk[channel] - 1)
            )
        }

        lift[channel * 5 + 4] = isLightApp ? 0 : 1
        lift[15 + channel] = Float(boost * reach * lumaWeights[channel])
        remap[channel * 5 + 4] = Float(target[channel] - reach * anchor * toInk[channel])
        key[channel * 5 + 4] = Float(target[channel])
        key[15 + channel] = Float(-along[channel] / fade)
    }

    lift[19] = Float(-boost * reach * anchor)
    remap[18] = 1
    key[19] = Float(1 + targetAlong / fade)
    let filters = [lift, remap, key].compactMap(matrixFilter)

    return filters.count == filterStages ? filters : nil
}

func fallbackColor(config: TintConfig) -> CGColor {
    let target = displayComponents(hex: config.target).map { CGFloat($0) }
    let space = CGColorSpace(name: CGColorSpace.displayP3) ?? CGColorSpaceCreateDeviceRGB()

    return CGColor(colorSpace: space, components: target + [fallbackAlpha]) ?? NSColor.clear.cgColor
}

func visiblePath(target: CGRect, occluders: [CGRect], radius: CGFloat) -> CGPath {
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
    private var appliedConfig: TintConfig?
    private var app = AppLayout(sidebar: nil, themeMode: nil)
    private var appStamp: Date?
    private var appliedIsLight: Bool?
    private var overlays: [CGWindowID: Overlay] = [:]
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

    private func reloadApp() {
        let stamp = (try? FileManager.default.attributesOfItem(atPath: appLayoutURL.path))?[.modificationDate] as? Date

        if stamp == appStamp {
            return
        }

        appStamp = stamp
        app = appLayout()
    }

    private func appIsLight(_ config: TintConfig) -> Bool {
        switch app.themeMode {
        case "light": return true
        case "dark": return false
        case "system": return !systemIsDark()
        default: return config.isLightApp ?? !systemIsDark()
        }
    }

    private func exitWhenIdle(since: inout Date?, limit: Double) {
        let started = since ?? Date()
        since = started

        if Date().timeIntervalSince(started) > limit {
            note("exit after \(limit)s: \(config == nil ? "no readable config" : config?.enabled == false ? "disabled" : "Claude not running")")
            exit(0)
        }
    }

    private func removeOverlays(except kept: Set<CGWindowID>) {
        for (id, overlay) in overlays where !kept.contains(id) {
            overlay.window.orderOut(nil)
            overlays[id] = nil
        }
    }

    private func style(_ overlay: Overlay, with config: TintConfig, isLightApp: Bool) {
        let filters = sessionFilters(config: config, isLightApp: isLightApp)

        for (stage, layer) in overlay.layers.enumerated() {
            layer.filters = filters.map { [$0[stage]] }
            layer.backgroundColor = filters == nil && stage == 0 ? fallbackColor(config: config) : nil
            layer.isHidden = filters == nil && stage > 0
        }
    }

    private func backdropLayer() -> (CALayer, CAShapeLayer) {
        let backdropClass = NSClassFromString("CABackdropLayer") as? CALayer.Type
        let layer = backdropClass?.init() ?? CALayer()

        if backdropClass != nil {
            layer.setValue(true, forKey: "windowServerAware")
            layer.setValue(1.0, forKey: "scale")
            layer.setValue(0.0, forKey: "bleedAmount")
        }

        let mask = CAShapeLayer()
        mask.fillColor = NSColor.black.cgColor
        layer.mask = mask

        return (layer, mask)
    }

    private func overlay(for id: CGWindowID, frame: NSRect, config: TintConfig, isLightApp: Bool) -> Overlay {
        if let existing = overlays[id] {
            return existing
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
        let stages = (0..<filterStages).map { _ in backdropLayer() }
        stages.forEach { view.layer?.addSublayer($0.0) }
        window.contentView = view
        let made = Overlay(window: window, layers: stages.map(\.0), masks: stages.map(\.1))
        style(made, with: config, isLightApp: isLightApp)
        overlays[id] = made

        return made
    }

    private func tick() {
        tickCount += 1

        if Date() > hotUntil, tickCount % idleTicksPerCheck != 0 {
            return
        }

        reloadConfig()
        reloadApp()

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
        let onScreen = screenWindows()
        let menuBars = onScreen
            .filter { $0.layer == menuBarLayer && $0.bounds.minY <= 0 && $0.bounds.height <= tallestMenuBar }
            .map(\.bounds)
        let isLightApp = appIsLight(config)
        let appWindows = onScreen.filter { window in
            pids.contains(window.pid) && window.layer == 0 && window.alpha > 0.01
                && window.bounds.width >= smallestTarget.width && window.bounds.height >= smallestTarget.height
                && !menuBars.contains { bar in bar.intersection(window.bounds).height > menuBarOverlapAllowed }
        }
        let isDialog = { (window: ScreenWindow) -> Bool in
            appWindows.contains { other in
                other.id != window.id && other.bounds != window.bounds && other.bounds.contains(window.bounds)
            }
        }
        let isRestyled = appliedConfig != config || appliedIsLight != isLightApp
        var occluders: [CGRect] = []
        var covered: [CGRect] = []
        var kept = Set<CGWindowID>()
        var layout = "\(config)|\(isLightApp)"

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
               !isDialog(candidate),
               !covered.contains(candidate.bounds) {
                covered.append(candidate.bounds)
                let frame = NSRect(
                    x: candidate.bounds.minX,
                    y: mainHeight - candidate.bounds.maxY,
                    width: size.width,
                    height: size.height
                )
                let placed = overlay(for: candidate.id, frame: frame, config: config, isLightApp: isLightApp)

                if placed.window.frame != frame {
                    placed.window.setFrame(frame, display: true)
                }

                if isRestyled {
                    style(placed, with: config, isLightApp: isLightApp)
                }

                let local = CGRect(origin: .zero, size: size)
                var untouched = occluders

                if config.coverSidebar != true, let sidebar = app.sidebar, !sidebar.isCollapsed,
                   size.width > narrowestWindowWithSidebar {
                    untouched.append(
                        CGRect(
                            x: candidate.bounds.minX,
                            y: candidate.bounds.minY,
                            width: sidebar.width,
                            height: size.height
                        )
                    )
                }

                let path = visiblePath(
                    target: candidate.bounds,
                    occluders: untouched,
                    radius: CGFloat(config.radius)
                )

                for (layer, mask) in zip(placed.layers, placed.masks) {
                    layer.frame = local
                    mask.frame = local
                    mask.path = path
                }

                if !placed.window.isVisible {
                    placed.window.orderFrontRegardless()
                }

                kept.insert(candidate.id)
                layout += "|\(candidate.id):\(candidate.bounds):\(untouched)"
            }

            if size.width >= smallestOccluder.width, size.height >= smallestOccluder.height {
                occluders.append(candidate.bounds)
            }
        }

        CATransaction.commit()
        removeOverlays(except: kept)
        appliedConfig = config
        appliedIsLight = isLightApp

        if layout != lastLayout {
            let front = onScreen.prefix(12).map { "\($0.owner):\($0.layer):\(Int($0.bounds.minX)),\(Int($0.bounds.minY)) \(Int($0.bounds.width))x\(Int($0.bounds.height))" }
            note("covering \(kept.count) window(s); in front: \(front.joined(separator: " | "))")
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
note("started")
let tinter = Tinter()
tinter.start()
application.run()
