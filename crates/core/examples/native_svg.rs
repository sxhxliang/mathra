//! `cargo run -p mathra --example native_svg -- target/native-preview`
//! Writes light/dark standalone proof images and prints their logical size and baseline.
use std::path::PathBuf;

use mathra::{render_svg, Options, SvgRenderOptions};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = PathBuf::from(std::env::args_os().nth(1).unwrap_or_else(|| "target/native-preview".into()));
    std::fs::create_dir_all(&directory)?;
    let source = r"\begin{prooftree}\AxiomC{A \fCenter B}\AxiomC{B \fCenter C}\LeftLabel{cut}\RightLabel{\alpha}\dashedLine\BinaryInfC{A \fCenter C}\end{prooftree}";
    let options = Options { strict: true, ..Options::default() };
    for (name, color) in [("light", 0x112233), ("dark", 0xddeeff)] {
        let image = render_svg(source, &options, &SvgRenderOptions { font_size: 32.0, color, ..Default::default() })?;
        let path = directory.join(format!("proof-{name}.svg"));
        std::fs::write(&path, &image.svg)?;
        println!("{}: {} × {}, ascent {}", path.display(), image.width, image.height, image.ascent);
    }
    Ok(())
}
