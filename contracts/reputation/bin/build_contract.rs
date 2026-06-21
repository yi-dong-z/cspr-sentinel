#![no_std]
#![cfg_attr(target_arch = "wasm32", no_main)]
#![allow(unused_imports, clippy::single_component_path_imports)]

use cspr_sentinel_reputation;

#[cfg(not(target_arch = "wasm32"))]
fn main() {}
