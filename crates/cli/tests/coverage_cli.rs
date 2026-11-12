//! The command line's less traveled paths: options left without their value, files that cannot be
//! read or written, and a PNG that cannot be made.

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
    let p = std::env::temp_dir().join(format!("mathra-cli-cov-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).unwrap();
    p
}

#[test]
fn an_option_without_its_value_exits_with_code_2() {
    for (option, message) in [
        ("--from", "missing format after --from"),
        ("--font", "missing file after --font"),
        ("--fallback-font", "missing file after --fallback-font"),
        ("--braille-code", "missing code after --braille-code"),
        ("--label", "missing key=number after --label"),
        ("--cite", "missing key=number after --cite"),
        ("--background", "missing color after --background"),
        ("--color", "missing color after --color"),
    ] {
        let o = mathra(&["x", option], None);
        assert_eq!(o.status.code(), Some(2), "{option}");
        assert_eq!(stderr(&o).trim(), format!("mathra: {message}"), "{option}");
        assert!(o.stdout.is_empty(), "{option}");
    }
}

#[test]
fn label_and_cite_take_key_equals_number() {
    for (args, message) in [
        (&["x", "--label", "eq:a"][..], "--label takes key=number, as in --label eq:a=3 (got eq:a)"),
        (&["x", "--label", " =3"][..], "--label takes key=number, as in --label eq:a=3 (got  =3)"),
        (&["x", "--cite", "knuth"][..], "--cite takes key=number, as in --cite eq:a=3 (got knuth)"),
    ] {
        let o = mathra(args, None);
        assert_eq!(o.status.code(), Some(2), "{args:?}");
        assert_eq!(stderr(&o).trim(), format!("mathra: {message}"), "{args:?}");
    }
    // the key and the number are trimmed
    let o = mathra(&[r"\eqref{eq:a} \cite{knuth}", "--label", " eq:a = 3 ", "--cite", "knuth= 1", "--text", "--strict"], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert_eq!(stdout(&o).trim(), "(3)[1]");
}

#[test]
fn a_fallback_font_that_cannot_be_read() {
    let o = mathra(&["x", "--fallback-font", "no-such-fallback.ttf"], None);
    assert_eq!(o.status.code(), Some(2));
    assert!(stderr(&o).starts_with("mathra: cannot read no-such-fallback.ttf: "), "{}", stderr(&o));
    assert!(o.stdout.is_empty());
}

#[test]
fn explain_says_when_no_rule_changed_the_result() {
    let o = mathra(&["x", "--explain"], None);
    assert!(o.status.success());
    let out = stdout(&o);
    assert!(out.contains("rules    no rule changed the result\n"), "{out}");
    assert!(!out.contains("warnings"), "{out}");
}

#[test]
fn an_svg_into_a_missing_folder_is_an_error() {
    let p = folder("missing-svg").join("no-such-folder").join("x.svg");
    let o = mathra(&["x", "-o", p.to_str().unwrap()], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).contains(&format!("could not write {}", p.display())), "{}", stderr(&o));
}

#[cfg(feature = "png")]
#[test]
fn a_png_too_large_is_an_error() {
    let o = mathra(&["x", "--png", "--dpi", "1e7"], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).contains("the image would be too large"), "{}", stderr(&o));
    assert!(o.stdout.is_empty());
    // in a batch, the line says it and the next one still goes
    let p = folder("batch-too-large");
    let o = mathra(&["--batch", "--png", "--dpi", "1e7", "-o", p.to_str().unwrap()], Some(b"x\n"));
    assert!(o.status.success());
    let out = stdout(&o);
    assert!(out.starts_with(&format!("error\tcould not write {}/1.png: the image would be too large", p.display())), "{out}");
    assert!(!p.join("1.png").exists());
}

#[cfg(feature = "png")]
#[test]
fn a_png_into_a_missing_folder_is_an_error() {
    let base = folder("missing-png");
    let p = base.join("no-such-folder").join("x.png");
    let o = mathra(&["x", "-o", p.to_str().unwrap()], None);
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).contains(&format!("could not write {}", p.display())), "{}", stderr(&o));
    // and a batch of PNGs into a folder that is not there: an error on every line
    let missing = base.join("no-such-folder");
    let o = mathra(&["--batch", "--png", "-o", missing.to_str().unwrap()], Some(b"x\ny\n"));
    assert!(o.status.success());
    let lines: Vec<String> = stdout(&o).lines().map(str::to_string).collect();
    assert_eq!(lines.len(), 2, "{lines:?}");
    for (i, line) in lines.iter().enumerate() {
        assert!(line.starts_with(&format!("error\tcould not write {}/{}.png: ", missing.display(), i + 1)), "{line}");
    }
}

/// A PNG to a standard output nobody reads: said on stderr, with exit code 1.
#[cfg(feature = "png")]
#[test]
fn a_png_to_a_closed_stdout_is_an_error() {
    let (reader, writer) = std::io::pipe().unwrap();
    drop(reader);
    let o = Command::new(env!("CARGO_BIN_EXE_mathra")).args(["x", "--png"]).stdin(Stdio::null()).stdout(writer).stderr(Stdio::piped()).output().unwrap();
    assert_eq!(o.status.code(), Some(1));
    assert!(stderr(&o).starts_with("mathra: could not write the PNG: "), "{}", stderr(&o));
}

#[test]
fn a_chemfig_structure_is_read_by_its_formula() {
    // benzene: six vertices of an aromatic ring, each a carbon with one hydrogen; ammonium by its \charge
    let o = mathra(&["--speech", r"\chemfig{**6(------)} \quad \chemfig{\charge{90=$\oplus$}{N}H_4}"], None);
    assert!(o.status.success(), "{}", stderr(&o));
    assert_eq!(stdout(&o).trim(), "structure of C6 H6, with 1 aromatic ring structure of H4 N, charge +1");
    // propane drawn as a skeleton: each vertex a carbon with the hydrogens its bonds leave room for
    let o = mathra(&["--speech", r"\chemfig{-[:30]-[:-30]}"], None);
    assert_eq!(stdout(&o).trim(), "structure of C3 H8");
}
