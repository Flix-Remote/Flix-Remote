// SPDX-License-Identifier: MIT
import UIKit
import Capacitor
import AppPlugin
import FilesystemPlugin
import PreferencesPlugin
import SharePlugin

private final class DayRemoteController: HomeRemoteViewController {
    let assets: URL
    init(assets: URL) { self.assets = assets; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Use the bundled asset initializer") }
    override func instanceDescriptor() -> InstanceDescriptor {
        InstanceDescriptor(at: assets,
            configuration: assets.appendingPathComponent("capacitor.config.json"),
            cordovaConfiguration: nil)
    }
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppPlugin())
        bridge?.registerPluginInstance(FilesystemPlugin())
        bridge?.registerPluginInstance(PreferencesPlugin())
        bridge?.registerPluginInstance(SharePlugin())
    }
}
private final class DayRemoteView: UIView {
    let controller: DayRemoteController
    init(assets: URL) {
        controller = DayRemoteController(assets: assets)
        super.init(frame: .zero)
        accessibilityIdentifier = "flix-remote-surface"
    }
    required init?(coder: NSCoder) { fatalError("Use the bundled asset initializer") }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else {
            controller.willMove(toParent: nil)
            controller.viewIfLoaded?.removeFromSuperview()
            controller.removeFromParent()
            return
        }
        guard controller.parent == nil else { return }
        var responder: UIResponder? = next
        while let current = responder, !(current is UIViewController) { responder = current.next }
        guard let parent = responder as? UIViewController else { return }
        parent.addChild(controller)
        addSubview(controller.view)
        controller.view.frame = bounds
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        controller.didMove(toParent: parent)
    }
}
@_cdecl("flix_day_remote_create")
// Rust calls this C entry point outside the Swift module. Keep it exported in
// optimized SwiftPM builds as well as the simulator's unoptimized build.
public func flixDayRemoteCreate(_ path: UnsafePointer<CChar>) -> UnsafeMutableRawPointer {
    dispatchPrecondition(condition: .onQueue(.main))
    let view = DayRemoteView(assets: URL(fileURLWithPath: String(cString: path), isDirectory: true))
    return Unmanaged.passRetained(view).toOpaque()
}
