//! The command line run as a process, the way someone would use it in a terminal.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};

fn mathra(args: &[&str], input: Option<&[u8]>) -> Output {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_mathra"));
    cmd.args(args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().expect("the binary runs");
    {
        let mut stdin = child.stdin.take().unwrap();
        if let Some(e) = input {
            // a command that refuses its arguments exits without reading stdin: the pipe closes
            // under the write, and the exit code and stderr are what the test checks
            if let Err(err) = stdin.write_all(e) {
                assert_eq!(err.kind(), std::io::ErrorKind::BrokenPipe, "{err}");
            }
        }
    }
    child.wait_with_output().unwrap()
}

fn stdout(o: &Output) -> String {
    String::from_utf8_lossy(&o.stdout).into_owned()
}

fn stderr(o: &Output) -> String {
    String::from_utf8_lossy(&o.stderr).into_owned()
}

fn folder(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("mathra-cli-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).unwrap();
    p
}

#[test]
fn help_and_version() {
    for a in ["-h", "--help"] {
        let o = mathra(&[a], None);
        assert!(o.status.success());
        assert!(stdout(&o).contains("USAGE"));
    }
    for a in ["-V", "--version"] {
        let o = mathra(&[a], None);
        assert!(o.status.success());
        assert!(stdout(&o).starts_with("mathra "));
    }
}

#[test]
fn argument_errors_exit_with_code_2() {
    for (args, snippet) in [
        (&["x", "-o"][..], "--output"),
        (&["x", "--locale"][..], "--locale"),
        (&["x", "-l", "klingon"][..], "klingon"),
        (&["x", "--made-up"][..], "unknown option"),
        (&["x", "y"][..], "single equation"),
    ] {
        let o = mathra(args, None);
        assert_eq!(o.status.code(), Some(2), "{args:?}");
        assert!(stderr(&o).contains(snippet), "{args:?}: {}", stderr(&o));
    }
}

#[test]
fn no_equation_and_no_stdin_shows_help() {
    let o = mathra(&[], Some(b"   \n"));
    assert_eq!(o.status.code(), Some(2));
    assert!(stderr(&o).contains("USAGE"));
}

#[test]
fn equation_from_stdin() {
    let o = mathra(&[], Some(b"  x^2  \n"));
    assert!(o.status.success());
    assert!(stdout(&o).starts_with("<svg"));
}

#[test]
fn a_control_space_that_ends_the_input_is_kept() {
    // #254: as an argument and from stdin, `a\ ` is a space at the end, not a lone backslash
    for o in [mathra(&["a\\ ", "--text"], None), mathra(&["--text"], Some(b"a\\ ")), mathra(&["--text"], Some(b"a\\ \n"))] {
        assert!(o.status.success());
        assert_eq!(stdout(&o).trim(), "a");
        assert!(stderr(&o).is_empty(), "{}", stderr(&o));
    }
}

#[test]
fn output_modes() {
    let o = mathra(&["\\frac{a}{b}", "--tree"], None);
    assert!(stdout(&o).trim_start().starts_with('{'));
    let o = mathra(&["\\frac{a}{b}", "--speech"], None);
    assert!(stdout(&o).contains("over"), "{}", stdout(&o));
    let o = mathra(&["\\frac{a}{b}", "--speech", "--locale", "pt-BR"], None);
    assert!(stdout(&o).contains("sobre"), "{}", stdout(&o));
    let o = mathra(&["\\frac{a}{b}", "--text"], None);
    assert!(stdout(&o).contains("a/b"), "{}", stdout(&o));
    let o = mathra(&["x", "--inline", "-l", "en"], None);
    assert!(stdout(&o).starts_with("<svg"));
}

#[test]
fn explain_lists_rules_and_warnings() {
    let o = mathra(&["3,14", "--explain", "--locale", "pt-BR"], None);
    let s = stdout(&o);
    assert!(s.contains("rules\n") && s.contains("L-NUM"), "{s}");
    let o = mathra(&["x", "--explain"], None);
    assert!(stdout(&o).contains("no rule changed"));
    let o = mathra(&["\\madeupcommand x", "--explain"], None);
    let s = stdout(&o);
    assert!(s.contains("warnings\n"), "{s}");
    assert!(stderr(&o).is_empty(), "with --explain the warning goes to stdout, not stderr");
}

#[test]
fn warning_goes_to_stderr_and_strict_refuses() {
    let o = mathra(&["\\madeupcommand x"], None);
    assert!(o.status.success());
    assert!(stderr(&o).contains("warning"));
    let o = mathra(&["\\madeupcommand x", "--strict"], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(!stderr(&o).is_empty());
}

#[test]
fn writes_to_file() {
    let p = folder("file");
    let file = p.join("x.svg");
    let o = mathra(&["x", "-o", file.to_str().unwrap()], None);
    assert!(o.status.success());
    assert!(std::fs::read_to_string(&file).unwrap().starts_with("<svg"));
    let o = mathra(&["x", "--output", p.join("does/not/exist/x.svg").to_str().unwrap()], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).contains("could not write"));
}

#[test]
fn batch_one_line_per_equation() {
    let p = folder("batch");
    let o = mathra(&["--batch", "--output", p.to_str().unwrap()], Some(b"x^2\n\\madeupcommand\n"));
    assert!(o.status.success());
    let lines: Vec<String> = stdout(&o).lines().map(str::to_string).collect();
    assert_eq!(lines[0], "ok");
    assert!(lines[1].starts_with("warning\t"), "{lines:?}");
    assert!(p.join("1.svg").exists() && p.join("2.svg").exists());

    let o = mathra(&["--batch", "--strict"], Some(b"\\frac{1}\nx\n"));
    let lines: Vec<String> = stdout(&o).lines().map(str::to_string).collect();
    assert!(lines[0].starts_with("error\t"), "{lines:?}");
    assert_eq!(lines[1], "ok");
}

#[test]
fn labels_and_citations() {
    let o = mathra(&[r"\text{by } \eqref{eq:a} \cite{knuth}", "--label", "eq:a=3", "--cite", "knuth=1", "--text", "--strict"], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert_eq!(stdout(&o).trim(), "by (3)[1]");
    // an unknown label: ?? with a warning, refused in strict mode
    let o = mathra(&[r"\eqref{eq:a}", "--text"], None);
    assert_eq!(stdout(&o).trim(), "(??)");
    assert!(stderr(&o).contains("E-REC-9"), "{}", stderr(&o));
    assert_eq!(mathra(&[r"\eqref{eq:a}", "--strict"], None).status.code(), Some(1));
    for bad in ["eq:a", "=3"] {
        let o = mathra(&["x", "--label", bad], None);
        assert_eq!(o.status.code(), Some(2), "{bad}");
        assert!(stderr(&o).contains("key=number"), "{}", stderr(&o));
    }
}

#[test]
fn batch_labels_count_for_the_lines_after_them() {
    let o = mathra(&["--batch", "--strict"], Some(b"\\eqref{eq:a}\na = b \\label{eq:a} \\tag{3}\n\\text{by } \\eqref{eq:a}\n"));
    let lines: Vec<String> = stdout(&o).lines().map(str::to_string).collect();
    assert!(lines[0].starts_with("error\t"), "{lines:?}");
    assert_eq!(&lines[1..], ["ok", "ok"], "{lines:?}");
}

#[test]
fn batch_flags_non_utf8_line_and_continues() {
    let o = mathra(&["--batch"], Some(b"x\n\xff\xfe\ny\n"));
    assert!(o.status.success());
    assert_eq!(stdout(&o), "ok\nerror\tthe line is not UTF-8\nok\n");
}

#[test]
fn batch_colors_are_defined_per_line_like_macros() {
    let p = folder("batch-colors");
    let input = b"\\definecolor{brand}{HTML}{1F6FEB}\\newcommand{\\b}{b}\\textcolor{brand}{x}\\b\n\\textcolor{brand}{x}\\b\n";
    let o = mathra(&["--batch", "-o", p.to_str().unwrap()], Some(input));
    let lines: Vec<String> = stdout(&o).lines().map(str::to_string).collect();
    assert_eq!(lines[0], "ok");
    // the second line knows neither the macro nor the color of the first
    assert!(lines[1].contains(r"\b"), "{lines:?}");
    assert!(std::fs::read_to_string(p.join("1.svg")).unwrap().contains(r##"fill="#1f6feb""##));
    let second = std::fs::read_to_string(p.join("2.svg")).unwrap();
    assert!(!second.contains("#1f6feb") && second.contains(r#"fill="brand""#), "{second}");
}

// --- problem cases ---

#[test]
fn batch_with_missing_folder_errors_on_every_line() {
    let p = folder("no-folder").join("does-not-exist");
    let o = mathra(&["--batch", "-o", p.to_str().unwrap()], Some(b"x\ny\n"));
    let s = stdout(&o);
    assert_eq!(s.lines().count(), 2);
    assert!(s.lines().all(|l| l.starts_with("error\tcould not write")), "{s}");
}

#[test]
fn batch_accepts_crlf_and_empty_lines_keeping_numbering() {
    let p = folder("crlf");
    let o = mathra(&["--batch", "-o", p.to_str().unwrap()], Some(b"x\r\n\n\\frac{1}{2}\r\n"));
    assert_eq!(stdout(&o), "ok\nok\nok\n");
    assert!(p.join("3.svg").exists(), "the 3rd line is still 3.svg");
}

#[test]
fn empty_equation_gives_valid_empty_svg() {
    let o = mathra(&[""], None);
    assert!(o.status.success());
    assert!(stdout(&o).contains(r#"viewBox="0 0 0 0""#));
}

#[test]
fn output_to_a_folder_is_a_clear_error() {
    let p = folder("folder-as-file");
    let o = mathra(&["x", "-o", p.to_str().unwrap()], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).contains("could not write"));
}

#[test]
fn huge_argument() {
    let tex = "x+".repeat(50_000) + "x";
    let o = mathra(&[&tex, "--text"], None);
    assert!(o.status.success());
    assert_eq!(stdout(&o).trim().chars().filter(|c| *c == '+').count(), 50_000);
}

#[test]
fn input_formats() {
    let o = mathra(&["sum_(i=1)^n i", "--from", "asciimath", "--text"], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert_eq!(stdout(&o).trim(), "∑_(i = 1)^n i");
    let o = mathra(&["-f", "mathml", "--speech"], Some(b"<math><msqrt><mi>x</mi></msqrt></math>"));
    assert_eq!(stdout(&o).trim(), "square root of x");
    // MathML passed as LaTeX is recognized
    let o = mathra(&["<math><mn>1</mn><mo>+</mo><mn>2</mn></math>", "--explain"], None);
    assert!(stdout(&o).contains("L-ENT-4"), "{}", stdout(&o));
    let o = mathra(&["x", "--from", "word"], None);
    assert_eq!(o.status.code(), Some(2));
    assert!(stderr(&o).contains("unknown input format"));
    assert!(stdout(&mathra(&["--help"], None)).contains("--from"));
}

#[test]
fn braille_output() {
    let o = mathra(&[r"\frac{3}{4}", "--locale", "pt-BR", "--braille"], None);
    assert_eq!(stdout(&o).trim(), "⠼⠒⠙");
    let o = mathra(&[r"\frac{3}{4}", "--braille", "--braille-code", "nemeth"], None);
    assert_eq!(stdout(&o).trim(), "⠹⠒⠌⠲⠼");
    let o = mathra(&["x^2", "--explain"], None);
    assert!(stdout(&o).contains("braille  ⠭⠘⠆ (nemeth)"), "{}", stdout(&o));
    let o = mathra(&["x", "--braille-code", "ueb"], None);
    assert_eq!(o.status.code(), Some(2));
    assert!(stderr(&o).contains("unknown braille code"));
}

#[test]
fn mathml_output() {
    let o = mathra(&[r"\frac{-b \pm \sqrt{b^2-4ac}}{2a}", "--mathml"], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert!(stdout(&o).starts_with(r#"<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mfrac>"#), "{}", stdout(&o));
    let o = mathra(&["x", "--mathml", "--inline"], None);
    assert!(stdout(&o).contains(r#"display="inline""#), "{}", stdout(&o));
    let o = mathra(&[r"\sen x", "--mathml", "--locale", "pt-BR"], None);
    assert!(stdout(&o).contains(r#"<mi intent="sine">sen</mi>"#), "{}", stdout(&o));
    // what MathML cannot draw: a <semantics> with the source, and the note on stderr
    let o = mathra(&[r"\divchave{125}{5}", "--mathml"], None);
    assert!(o.status.success());
    assert!(stdout(&o).contains(r#"<annotation encoding="application/x-tex">\divchave{125}{5}</annotation>"#), "{}", stdout(&o));
    assert!(stderr(&o).contains("note S-MML-1"), "{}", stderr(&o));
    // and the output reads back
    let mml = stdout(&mathra(&[r"\sqrt{x^2}", "--mathml"], None));
    let back = mathra(&["--from", "mathml", "--text"], Some(mml.trim().as_bytes()));
    assert_eq!(stdout(&back).trim(), stdout(&mathra(&[r"\sqrt{x^2}", "--text"], None)).trim());
}

#[test]
fn animate_and_steps() {
    let plain = stdout(&mathra(&[r"\frac{a}{b}"], None));
    let steps = stdout(&mathra(&[r"\frac{a}{b}", "--steps"], None));
    let animated = stdout(&mathra(&[r"\frac{a}{b}", "--animate"], None));
    assert!(!plain.contains("data-step"));
    assert!(steps.contains(r#"data-steps="3""#) && !steps.contains("@keyframes"));
    assert!(animated.contains(r#"data-steps="3""#) && animated.contains("@keyframes mr-f") && animated.contains("--mr-step"));
    assert!(stdout(&mathra(&["--help"], None)).contains("--animate"));
}

#[test]
fn max_width_breaks_lines() {
    let tex = "a = b + c + d + e + f + g + h";
    let plain = stdout(&mathra(&[tex], None));
    assert!(!plain.contains("data-line"));
    for width in ["4em", "4", " 4 em "] {
        let o = mathra(&[tex, "--max-width", width], None);
        assert!(o.status.success(), "{width}: {}", stderr(&o));
        assert!(stdout(&o).contains(r#"<g data-line="1">"#), "{width}");
        // a layout fact, not a warning: nothing on stderr
        assert!(stderr(&o).is_empty());
    }
    let explained = stdout(&mathra(&[tex, "--max-width", "4em", "--explain"], None));
    assert!(explained.contains("L-BRK-1"), "{explained}");
    // the speech does not change
    assert_eq!(stdout(&mathra(&[tex, "--max-width", "4em", "--speech"], None)), stdout(&mathra(&[tex, "--speech"], None)));
    for bad in ["wide", "0", "-3em", "em"] {
        let o = mathra(&[tex, "--max-width", bad], None);
        assert!(!o.status.success() && stderr(&o).contains("--max-width"), "{bad}");
    }
    assert!(!mathra(&[tex, "--max-width"], None).status.success());
    assert!(stdout(&mathra(&["--help"], None)).contains("--max-width"));
}

#[test]
fn a_math_font_from_a_file() {
    let font = concat!(env!("CARGO_MANIFEST_DIR"), "/../../tools/fonts/latinmodern-math.otf");
    let o = mathra(&[r"\frac{a}{b}", "--font", font], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert!(stdout(&o).contains("<mathra:font>Latin Modern Math</mathra:font>"));
    // not a font: said, and nothing drawn
    let o = mathra(&["x", "--font", concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml")], None);
    assert!(!o.status.success() && stderr(&o).contains("not a font"), "{}", stderr(&o));
    let o = mathra(&["x", "--font", "no-such-font.otf"], None);
    assert!(!o.status.success() && stderr(&o).contains("cannot read"), "{}", stderr(&o));
}

// --- PNG ---

/// Width and height from a PNG's IHDR chunk.
#[cfg(feature = "png")]
fn png_size(bytes: &[u8]) -> (u32, u32) {
    assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"), "not a PNG");
    let be = |i: usize| u32::from_be_bytes(bytes[i..i + 4].try_into().unwrap());
    (be(16), be(20))
}

#[cfg(feature = "png")]
#[test]
fn png_by_extension_or_flag() {
    let p = folder("png");
    let file = p.join("euler.PNG");
    let o = mathra(&["e^{i\\pi} + 1 = 0", "-o", file.to_str().unwrap()], None);
    assert!(o.status.success(), "{}", stderr(&o));
    let (w, h) = png_size(&std::fs::read(&file).unwrap());
    // 300 dpi by default: 50 pixels per em; --dpi 600 doubles each side (give or take the rounding up)
    let o = mathra(&["e^{i\\pi} + 1 = 0", "--png", "--dpi", "600"], None);
    assert!(o.status.success());
    let (w2, h2) = png_size(&o.stdout);
    assert!(w2.abs_diff(2 * w) <= 1 && h2.abs_diff(2 * h) <= 1, "{w}×{h} and {w2}×{h2}");
    // --png wins over another extension; any other extension is still an SVG
    let o = mathra(&["x", "--png", "-o", p.join("x.img").to_str().unwrap()], None);
    assert!(o.status.success());
    png_size(&std::fs::read(p.join("x.img")).unwrap());
    let o = mathra(&["x", "-o", p.join("x.jpg").to_str().unwrap()], None);
    assert!(o.status.success());
    assert!(std::fs::read_to_string(p.join("x.jpg")).unwrap().starts_with("<svg"));
    // the other outputs are text, whatever the file is called
    let o = mathra(&["x", "--speech", "-o", p.join("speech.png").to_str().unwrap()], None);
    assert!(o.status.success());
    assert_eq!(std::fs::read_to_string(p.join("speech.png")).unwrap().trim(), "x");
}

#[cfg(feature = "png")]
#[test]
fn png_colors_and_bad_options() {
    let white = mathra(&["x", "--png", "--background", "white", "--color", "#c00"], None);
    assert!(white.status.success());
    let clear = mathra(&["x", "--png"], None);
    assert_ne!(white.stdout, clear.stdout);
    assert_eq!(png_size(&white.stdout), png_size(&clear.stdout));
    for (args, snippet) in [
        (&["x", "--png", "--color", "nope"][..], "not a color: nope"),
        (&["x", "--png", "--background", "#12"][..], "not a color"),
        (&["x", "--png", "--dpi", "0"][..], "--dpi takes a positive number"),
        (&["x", "--png", "--dpi", "abc"][..], "--dpi takes a positive number"),
        (&["x", "--png", "--dpi"][..], "missing number after --dpi"),
        (&["--batch", "--png", "--color", "nope"][..], "not a color"),
    ] {
        let o = mathra(args, Some(b"x\n"));
        assert_eq!(o.status.code(), Some(2), "{args:?}");
        assert!(stderr(&o).contains(snippet), "{args:?}: {}", stderr(&o));
    }
}

#[cfg(feature = "png")]
#[test]
fn batch_writes_pngs_with_png() {
    let p = folder("batch-png");
    let o = mathra(&["--batch", "--png", "--dpi", "150", "-o", p.to_str().unwrap()], Some(b"x^2\n\\frac{1}{2}\n"));
    assert_eq!(stdout(&o), "ok\nok\n");
    for name in ["1.png", "2.png"] {
        png_size(&std::fs::read(p.join(name)).unwrap());
    }
    assert!(!p.join("1.svg").exists());
}

/// A build without the `png` feature (`cargo test -p mathra-cli --no-default-features`) refuses PNG
/// output rather than write an SVG into a .png file.
#[cfg(not(feature = "png"))]
#[test]
fn without_the_png_feature_png_is_refused() {
    let p = folder("no-png");
    for args in [&["x", "-o", p.join("x.png").to_str().unwrap()][..], &["x", "--png"][..], &["--batch", "--png", "-o", p.to_str().unwrap()][..]] {
        let o = mathra(args, Some(b"x\n"));
        assert_eq!(o.status.code(), Some(2), "{args:?}");
        assert!(stderr(&o).contains("PNG output is not supported in this build; use .svg"), "{args:?}: {}", stderr(&o));
        assert!(o.stdout.is_empty(), "{args:?}");
    }
    assert!(!p.join("x.png").exists() && !p.join("1.png").exists());
    // any other extension is still an SVG
    let o = mathra(&["x", "-o", p.join("x.jpg").to_str().unwrap()], None);
    assert!(o.status.success());
    assert!(std::fs::read_to_string(p.join("x.jpg")).unwrap().starts_with("<svg"));
}

#[cfg(feature = "emoji")]
#[test]
fn emoji_from_the_embedded_noto_emoji() {
    // the issue's examples (#125): drawn with no warning, and strict accepts them
    for tex in ["E = mc^2 😀", r"🍎 + 🍎 = 2 \cdot 🍎", r"\text{nota: 10 ⭐}"] {
        let o = mathra(&[tex], None);
        assert!(o.status.success() && stderr(&o).is_empty(), "{tex}: {}", stderr(&o));
        assert!(mathra(&[tex, "--strict"], None).status.success(), "{tex}");
    }
    assert!(mathra(&["😀 + ∑ ∫ α → ℝ", "--strict"], None).status.success());
}

#[test]
fn fallback_fonts_from_files() {
    let a = concat!(env!("CARGO_MANIFEST_DIR"), "/../core/tests/fonts/fallback-a.ttf");
    // 中 is in neither STIX Two Math nor Noto Emoji: a box, then drawn from the fallback
    let o = mathra(&[r"\text{中}"], None);
    assert!(stderr(&o).contains("E-REC-8"), "{}", stderr(&o));
    let o = mathra(&[r"\text{中}", "--fallback-font", a, "--strict"], None);
    assert!(o.status.success() && stderr(&o).is_empty(), "{}", stderr(&o));
    assert!(stdout(&o).contains("M100 -100 L900 -100"));
    // tried before Noto Emoji: fallback-a's diamond for 😀
    let o = mathra(&["😀", "--fallback-font", a], None);
    assert!(stdout(&o).contains("M500 -100 L900 300"));
    let o = mathra(&["x", "--fallback-font", concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml")], None);
    assert!(!o.status.success() && stderr(&o).contains("not a font"), "{}", stderr(&o));
}

/// `--png` draws what the SVG draws: the fallback fonts and the line width apply to it too.
#[cfg(feature = "png")]
#[test]
fn png_with_fallback_fonts_and_max_width() {
    let a = concat!(env!("CARGO_MANIFEST_DIR"), "/../core/tests/fonts/fallback-a.ttf");
    let o = mathra(&[r"\text{中}", "--png", "--strict"], None);
    assert!(!o.status.success() && o.stdout.is_empty(), "{}", stderr(&o));
    let o = mathra(&[r"\text{中}", "--png", "--strict", "--fallback-font", a], None);
    assert!(o.status.success() && stderr(&o).is_empty(), "{}", stderr(&o));
    png_size(&o.stdout);
    let tex = "f(x) = a_0 + a_1 x + a_2 x^2 + a_3 x^3 + a_4 x^4 + a_5 x^5 + a_6 x^6 + 中";
    let (w, h) = png_size(&mathra(&[tex, "--png", "--fallback-font", a], None).stdout);
    let (w2, h2) = png_size(&mathra(&[tex, "--png", "--fallback-font", a, "--max-width", "8"], None).stdout);
    assert!(w2 < w && h2 > h, "{w}×{h} and {w2}×{h2}");
}
