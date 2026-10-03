import AppKit
import Darwin

struct TintConfig: Decodable, Equatable {
    var enabled: Bool
    var target: String
    var radius: Double
    var isLightApp: Bool?
}

struct SidebarLayout: Equatable {
    var width: CGFloat
    var isCollapsed: Bool
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
    let recolor: CALayer
    let mask: CAShapeLayer
}

let helperDirectory = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".claude/clubhouse-helper", isDirectory: true)
let configURL = helperDirectory.appendingPathComponent("tint.json")
let lockPath = helperDirectory.appendingPathComponent("tint.lock").path
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
let keyFade = 22.0 / 255
let fallbackAlpha: CGFloat = 0.3

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

func sidebarLayout() -> SidebarLayout? {
    guard let data = try? Data(contentsOf: appLayoutURL),
          let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let layout = root["bootFrameLayout"] as? [String: Any],
          let width = layout["sidebarWidth"] as? Double
    else {
        return nil
    }

    return SidebarLayout(width: CGFloat(width), isCollapsed: layout["collapsed"] as? Bool ?? false)
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

func surfaceKeyFilter(config: TintConfig) -> NSObject? {
    guard let filterClass = NSClassFromString("CAFilter") as? NSObject.Type,
          let filter = filterClass.perform(NSSelectorFromString("filterWithType:"), with: "colorMatrix")?
              .takeUnretainedValue() as? NSObject
    else {
        return nil
    }

    let target = displayComponents(hex: config.target)
    let gain = 1 / keyFade
    let isLightApp = config.isLightApp ?? false
    let weight = Float((isLightApp ? gain : -gain) / 3)
    let offset = Float(isLightApp ? 1 - gain * lightSurfaceLimit : 1 + gain * darkSurfaceLimit)
    let matrix: [Float] = [
        0, 0, 0, 0, Float(target[0]),
        0, 0, 0, 0, Float(target[1]),
        0, 0, 0, 0, Float(target[2]),
        weight, weight, weight, 0, offset,
    ]
    let boxed = matrix.withUnsafeBytes {
        NSValue(bytes: $0.baseAddress!, objCType: "{CAColorMatrix=ffffffffffffffffffff}")
    }
    filter.setValue(boxed, forKey: "inputColorMatrix")

    return filter
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
    private var sidebar: SidebarLayout?
    private var sidebarStamp: Date?
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

    private func reloadSidebar() {
        let stamp = (try? FileManager.default.attributesOfItem(atPath: appLayoutURL.path))?[.modificationDate] as? Date

        if stamp == sidebarStamp {
            return
        }

        sidebarStamp = stamp
        sidebar = sidebarLayout()
    }

    private func exitWhenIdle(since: inout Date?, limit: Double) {
        let started = since ?? Date()
        since = started

        if Date().timeIntervalSince(started) > limit {
            exit(0)
        }
    }

    private func removeOverlays(except kept: Set<CGWindowID>) {
        for (id, overlay) in overlays where !kept.contains(id) {
            overlay.window.orderOut(nil)
            overlays[id] = nil
        }
    }

    private func style(_ overlay: Overlay, with config: TintConfig) {
        if let filter = surfaceKeyFilter(config: config) {
            overlay.recolor.backgroundColor = nil
            overlay.recolor.filters = [filter]
        } else {
            overlay.recolor.filters = nil
            overlay.recolor.backgroundColor = fallbackColor(config: config)
        }
    }

    private func overlay(for id: CGWindowID, frame: NSRect, config: TintConfig) -> Overlay {
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
        let backdropClass = NSClassFromString("CABackdropLayer") as? CALayer.Type
        let recolor = backdropClass?.init() ?? CALayer()

        if backdropClass != nil {
            recolor.setValue(true, forKey: "windowServerAware")
            recolor.setValue(1.0, forKey: "scale")
            recolor.setValue(0.0, forKey: "bleedAmount")
        }

        let mask = CAShapeLayer()
        mask.fillColor = NSColor.black.cgColor
        recolor.mask = mask
        view.layer?.addSublayer(recolor)
        window.contentView = view
        let made = Overlay(window: window, recolor: recolor, mask: mask)
        style(made, with: config)
        overlays[id] = made

        return made
    }

    private func tick() {
        tickCount += 1

        if Date() > hotUntil, tickCount % idleTicksPerCheck != 0 {
            return
        }

        reloadConfig()
        reloadSidebar()

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
        let menuBars = onScreen.filter { $0.layer == menuBarLayer }.map(\.bounds)
        let isRestyled = appliedConfig != config
        var occluders: [CGRect] = []
        var covered: [CGRect] = []
        var kept = Set<CGWindowID>()
        var layout = "\(config)"

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
                let placed = overlay(for: candidate.id, frame: frame, config: config)

                if placed.window.frame != frame {
                    placed.window.setFrame(frame, display: true)
                }

                if isRestyled {
                    style(placed, with: config)
                }

                let local = CGRect(origin: .zero, size: size)
                placed.recolor.frame = local
                placed.mask.frame = local
                var untouched = occluders

                if let sidebar, !sidebar.isCollapsed, size.width > narrowestWindowWithSidebar {
                    untouched.append(
                        CGRect(
                            x: candidate.bounds.minX,
                            y: candidate.bounds.minY,
                            width: sidebar.width,
                            height: size.height
                        )
                    )
                }

                placed.mask.path = visiblePath(
                    target: candidate.bounds,
                    occluders: untouched,
                    radius: CGFloat(config.radius)
                )

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
