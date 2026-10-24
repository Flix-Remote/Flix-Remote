// SPDX-License-Identifier: MIT
use day_core::{BuildCx, Flex, Piece, RNode};

const KIND: &str = "com.flix.remote.native";
#[derive(Clone)]
struct RemoteProps;
pub struct Remote;
pub fn remote() -> Remote {
    #[cfg(feature = "dom")]
    dom::register();
    Remote
}
impl Piece for Remote {
    fn build(self, cx: &mut BuildCx) -> RNode {
        cx.leaf(
            KIND,
            &RemoteProps,
            Flex {
                grow_w: true,
                grow_h: true,
                ..Default::default()
            },
        )
    }
}

#[cfg(all(feature = "uikit", target_os = "ios"))]
mod uikit {
    use super::*;
    use day_spec::NodeId;
    use day_uikit::Uikit;
    use objc2::rc::Retained;
    use objc2_ui_kit::UIView;
    use std::ffi::{CString, c_char};
    unsafe extern "C" {
        fn flix_day_remote_create(assets: *const c_char) -> *mut UIView;
    }
    fn make(_: &mut Uikit, _: &RemoteProps, _: NodeId) -> Retained<UIView> {
        let path = day_spec::resolve_asset_dir("public")
            .expect("FLIX bundled remote assets must be staged before building")
            .to_string_lossy()
            .into_owned();
        let path = CString::new(path).expect("bundled asset path");
        // Swift transfers +1 ownership to Day's node.
        unsafe { Retained::from_raw(flix_day_remote_create(path.as_ptr())) }
            .expect("FLIX native remote view")
    }
    day_pieces::renderer!(day_uikit::RENDERERS, Uikit,
        kind: KIND, props: RemoteProps, make: make, measure: day_pieces::fill_measure);
}

#[cfg(all(feature = "mdc", target_os = "android"))]
mod android {
    use super::*;
    use day_android::{AHandle, Android};
    use day_spec::NodeId;
    day_android::java_class! {
        DayRemoteView => com.flix.homeremote.DayRemoteView,
        methods { static fn create() -> android.view.View, },
    }
    fn make(_: &mut Android, _: &RemoteProps, _: NodeId) -> AHandle {
        day_android::realize("flix-remote", DayRemoteView::create)
    }
    day_pieces::renderer!(day_android::RENDERERS, Android,
        kind: KIND, props: RemoteProps, make: make, measure: day_pieces::fill_measure);
}

#[cfg(feature = "dom")]
mod dom {
    use super::*;
    use day_dom::{Dom, DomHandle};
    use day_spec::{NodeId, Proposal, Size};
    fn make(b: &mut Dom, _: &RemoteProps, _: NodeId) -> DomHandle {
        let h = b.element("iframe");
        b.set_attr(&h, "src", "assets/data/public/index.html");
        b.set_attr(&h, "title", &crate::res::str::remote_title().format());
        b.set_attr(&h, "style", "border:0;width:100%;height:100%;display:block");
        b.set_attr(&h, "allow", "microphone; clipboard-write");
        h
    }
    fn measure(_: &mut Dom, _: &DomHandle, p: Proposal) -> Size {
        Size::new(p.width.unwrap_or(390.0), p.height.unwrap_or(844.0))
    }
    day_pieces::dom_renderer!(day_dom::register_renderer, Dom,
        kind: KIND, props: RemoteProps, make: make, measure: measure);
}
