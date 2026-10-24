// SPDX-License-Identifier: MIT
use day::prelude::*;
mod remote;
day::resources!();
day::day_start!(options: window(), root);

pub fn window() -> day::WindowOptions {
    res::window_options()
}

pub fn root() -> impl Piece {
    remote::remote().id(day::id!(flix_remote))
}
