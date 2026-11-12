use std::io::Write;
use std::path::Path;
use std::process::ExitCode;
use std::{env, fs, io};

use mathra::font::{FallbackFont, MathFont};
use mathra::{convert, BrailleCode, Input, Labels, Locale, Options};

const HELP: &str = "\
mathra — equations to SVG, no TeX install

USAGE
  mathra <equation> [options]
  echo '<equation>' | mathra [options]

OPTIONS
  -o, --output <file>     write the SVG to a file instead of printing it; a .png file
                          gets a PNG
  -l, --locale <code>     en (default), pt-BR, es, fr, de, it, ru, zh, ja, ko, hi, ar,
                          id, tr, nl or pl; a region is accepted (es-MX, zh-CN)
  -f, --from <format>     latex (default), mathml or asciimath; MathML pasted as
                          LaTeX (starting with <math) is recognized on its own
      --inline            inline style, as in $…$; the default is display style
      --max-width <w>     break lines wider than w em (30em or 30), after a relation
                          first, then after + and −; the default is one line
      --strict            refuse invalid LaTeX, like TeX (the default recovers and warns)
      --font <file>       set the equation in this OpenType math font (.otf or .ttf with a
                          MATH table); the default is STIX Two Math
                          (math fonts to download: https://matheusmota-dev-br.github.io/mathfonts/)
      --fallback-font <file>  a font (.otf or .ttf, any) for the characters the math font
                          lacks, such as CJK text; repeat it to try several in order.
                          Emoji come from the embedded Noto Emoji, tried after them
      --animate           the SVG writes itself in the browser, in the order the layout set it
      --steps             each element numbered by its step (data-step), with no animation
      --png               write a PNG instead of the SVG (to --output, or to stdout)
      --dpi <n>           PNG resolution over a 12pt body: an em is n × 12 / 72 pixels
                          (default 300, 50 pixels per em)
      --background <c>    PNG background, a CSS color (white, #fff); default transparent
      --color <c>         PNG ink, a CSS color; default #111 (\\color keeps its own)
      --explain           show the tree, the speech and the rules applied
      --tree              print only the tree of meaning as JSON
      --speech            print only the screen reader phrase
      --text              print only the linear text
      --braille           print only the braille (Unicode cells)
      --mathml            print only the MathML (MathML Core, with intent where it adds meaning)
      --braille-code <c>  cmu or nemeth; the default follows the locale
                          (CMU in pt-BR and es, Nemeth elsewhere)
      --label <key=n>     the number of a label, for \\ref and \\eqref (repeat for more);
                          an unknown label is ?? with a warning (an error with --strict)
      --cite <key=n>      the number of a citation, for \\cite (repeat for more);
                          an unknown key is ? with a warning (an error with --strict)
      --batch             read one equation per input line; with --output <folder>,
                          write 1.svg, 2.svg… (1.png, 2.png… with --png);
                          print ok, warning<TAB>… or error<TAB>… per line;
                          a \\label with a \\tag numbers the label for the lines after it
  -V, --version           show the version
  -h, --help              show this help

EXAMPLES
  mathra '3.14' -o pi.svg
  mathra 'e^{i\\pi} + 1 = 0' -o euler.png --dpi 600 --background white
  mathra '3,14' --locale pt-BR --explain
  mathra '\\frac{3}{4}' --locale fr --speech
  mathra '\\sin^2 x' --speech
  mathra 'sum_(i=1)^n i^2' --from asciimath
  mathra '<math><msqrt><mi>x</mi></msqrt></math>' --speech
  mathra '\\frac{3}{4}' --locale pt-BR --braille
  mathra 'f(x) = a_0 + a_1 x + a_2 x^2 + a_3 x^3' --max-width 12em -o long.svg
  mathra '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' --mathml
  mathra 'e^{i\\pi} + 1 = 0' --font LibertinusMath-Regular.otf -o euler.svg
  mathra '\\text{by } \\eqref{eq:a} \\cite{knuth}' --label eq:a=3 --cite knuth=1 --text
";

enum Mode {
    Batch,
    Svg,
    Explain,
    Tree,
    Speech,
    Text,
    Braille,
    MathMl,
}

struct Args {
    tex: Option<String>,
    output: Option<String>,
    locale: Locale,
    display: bool,
    strict: bool,
    input: Input,
    braille: Option<BrailleCode>,
    animate: bool,
    steps: bool,
    font: MathFont,
    max_width: Option<f32>,
    /// `--fallback-font`, in order; Noto Emoji comes after them.
    fallbacks: Vec<FallbackFont>,
    labels: Labels,
    citations: Labels,
    mode: Mode,
    /// `--png`: PNG in place of the SVG, also in a batch's folder.
    png: bool,
    dpi: f32,
    background: Option<String>,
    color: String,
}

impl Args {
    fn options(&self) -> Options {
        Options {
            locale: self.locale,
            display: self.display,
            strict: self.strict,
            input: self.input,
            braille: self.braille,
            animate: self.animate,
            steps: self.steps,
            font: self.font,
            max_width: self.max_width,
            fallback_fonts: self.fallbacks.iter().copied().chain(FallbackFont::defaults()).collect(),
            labels: self.labels.clone(),
            citations: self.citations.clone(),
            ..Default::default()
        }
    }

    /// The SVG of the equation goes out as a PNG: `--png`, or an output file named `.png`.
    fn wants_png(&self) -> bool {
        match self.mode {
            Mode::Svg => self.png || self.output.as_deref().is_some_and(|p| Path::new(p).extension().is_some_and(|e| e.eq_ignore_ascii_case("png"))),
            Mode::Batch => self.png,
            _ => false,
        }
    }

    #[cfg(feature = "png")]
    fn png_options(&self) -> mathra::PngOptions {
        mathra::PngOptions { dpi: self.dpi, background: self.background.clone(), color: self.color.clone() }
    }
}

/// What a build without the `png` feature says, instead of writing an SVG into a .png file.
#[cfg(not(feature = "png"))]
const PNG_UNSUPPORTED: &str = "PNG output is not supported in this build; use .svg";

/// The PNG options can be used: checked before converting anything.
fn check_png(args: &Args) -> Result<(), String> {
    #[cfg(feature = "png")]
    return args.png_options().check().map_err(|e| e.to_string());
    #[cfg(not(feature = "png"))]
    {
        let _ = args;
        Err(PNG_UNSUPPORTED.into())
    }
}

fn png(svg: &str, args: &Args) -> Result<Vec<u8>, String> {
    #[cfg(feature = "png")]
    return mathra::output::png::from_svg(svg, &args.png_options()).map_err(|e| e.to_string());
    #[cfg(not(feature = "png"))]
    {
        let _ = (svg, args);
        Err(PNG_UNSUPPORTED.into())
    }
}

/// `key=number`, as `--label` and `--cite` take it.
fn key_number(option: &str, value: Option<String>, into: &mut Labels) -> Result<(), String> {
    let value = value.ok_or(format!("missing key=number after {option}"))?;
    match value.split_once('=') {
        Some((key, number)) if !key.trim().is_empty() => {
            into.insert(key.trim().to_string(), number.trim().to_string());
            Ok(())
        }
        _ => Err(format!("{option} takes key=number, as in {option} eq:a=3 (got {value})")),
    }
}

fn read_args() -> Result<Option<Args>, String> {
    let mut args = Args {
        tex: None,
        output: None,
        locale: Locale::default(),
        display: true,
        strict: false,
        input: Input::Latex,
        braille: None,
        animate: false,
        steps: false,
        font: MathFont::default(),
        max_width: None,
        fallbacks: Vec::new(),
        labels: Labels::new(),
        citations: Labels::new(),
        mode: Mode::Svg,
        png: false,
        dpi: 300.0,
        background: None,
        color: "#111".into(),
    };
    let mut it = env::args().skip(1);
    while let Some(a) = it.next() {
        match a.as_str() {
            "-h" | "--help" => {
                print!("{HELP}");
                return Ok(None);
            }
            "-V" | "--version" => {
                println!("mathra {}", mathra::VERSION);
                return Ok(None);
            }
            "-o" | "--output" => args.output = Some(it.next().ok_or("missing file after --output")?),
            "-l" | "--locale" => args.locale = it.next().ok_or("missing code after --locale")?.parse()?,
            "-f" | "--from" => args.input = it.next().ok_or("missing format after --from")?.parse()?,
            "--explain" => args.mode = Mode::Explain,
            "--animate" => args.animate = true,
            "--steps" => args.steps = true,
            "--inline" => args.display = false,
            "--max-width" => args.max_width = Some(max_width(&it.next().ok_or("missing width after --max-width")?)?),
            "--strict" => args.strict = true,
            "--font" => {
                let path = it.next().ok_or("missing file after --font")?;
                let bytes = fs::read(&path).map_err(|e| format!("cannot read {path}: {e}"))?;
                args.font = MathFont::load(bytes).map_err(|e| format!("{path}: {e}"))?;
            }
            "--fallback-font" => {
                let path = it.next().ok_or("missing file after --fallback-font")?;
                let bytes = fs::read(&path).map_err(|e| format!("cannot read {path}: {e}"))?;
                args.fallbacks.push(FallbackFont::load(bytes).map_err(|e| format!("{path}: {e}"))?);
            }
            "--tree" => args.mode = Mode::Tree,
            "--speech" => args.mode = Mode::Speech,
            "--text" => args.mode = Mode::Text,
            "--braille" => args.mode = Mode::Braille,
            "--mathml" => args.mode = Mode::MathMl,
            "--braille-code" => args.braille = Some(it.next().ok_or("missing code after --braille-code")?.parse()?),
            "--label" => key_number("--label", it.next(), &mut args.labels)?,
            "--cite" => key_number("--cite", it.next(), &mut args.citations)?,
            "--batch" => args.mode = Mode::Batch,
            "--png" => args.png = true,
            "--dpi" => {
                let value = it.next().ok_or("missing number after --dpi")?;
                args.dpi = value.parse().ok().filter(|d: &f32| d.is_finite() && *d > 0.0).ok_or(format!("--dpi takes a positive number, not {value}"))?;
            }
            "--background" => args.background = Some(it.next().ok_or("missing color after --background")?),
            "--color" => args.color = it.next().ok_or("missing color after --color")?,
            option if option.starts_with("--") => return Err(format!("unknown option: {option} (see mathra --help)")),
            _ if args.tex.is_none() => args.tex = Some(a),
            _ => return Err("pass a single equation, in quotes".into()),
        }
    }
    Ok(Some(args))
}

/// `30em` or `30`: a positive number of em.
fn max_width(text: &str) -> Result<f32, String> {
    let number = text.trim().strip_suffix("em").unwrap_or(text.trim()).trim();
    match number.parse::<f32>() {
        Ok(w) if w.is_finite() && w > 0.0 => Ok(w),
        _ => Err(format!("invalid width after --max-width: {text} (use a positive number of em, such as 30em)")),
    }
}

fn main() -> ExitCode {
    let args = match read_args() {
        Ok(Some(args)) => args,
        Ok(None) => return ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("mathra: {e}");
            return ExitCode::from(2);
        }
    };

    if args.wants_png() {
        if let Err(e) = check_png(&args) {
            eprintln!("mathra: {e}");
            return ExitCode::from(2);
        }
    }

    if let Mode::Batch = args.mode {
        return batch(&args);
    }

    let tex = match args.tex.clone() {
        Some(t) => t,
        None => match io::read_to_string(io::stdin()) {
            // the reader trims the input itself: a form feed that starts it (a \frac JSON ate) or the
            // space of a control space that ends it (`a\ `, #254) are not whitespace to cut
            Ok(t) if !t.trim().is_empty() => t,
            _ => {
                eprint!("{HELP}");
                return ExitCode::from(2);
            }
        },
    };

    let result = match convert(&tex, &args.options()) {
        Ok(r) => {
            if !matches!(args.mode, Mode::Explain) {
                for a in &r.warnings {
                    eprintln!("mathra: warning {}: {}", a.rule, a.description);
                }
            }
            r
        }
        Err(e) => {
            eprintln!("mathra: {e}");
            return ExitCode::from(1);
        }
    };

    if args.wants_png() {
        let bytes = match png(&result.svg, &args) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("mathra: {e}");
                return ExitCode::from(1);
            }
        };
        let written = match &args.output {
            Some(path) => fs::write(path, bytes).map_err(|e| format!("could not write {path}: {e}")),
            None => io::stdout().lock().write_all(&bytes).map_err(|e| format!("could not write the PNG: {e}")),
        };
        if let Err(e) = written {
            eprintln!("mathra: {e}");
            return ExitCode::from(1);
        }
        return ExitCode::SUCCESS;
    }

    let text = match args.mode {
        Mode::Svg | Mode::Batch => result.svg,
        Mode::Tree => result.tree.to_json(),
        Mode::Speech => result.speech,
        Mode::Braille => result.braille,
        Mode::MathMl => {
            // not a problem with the input, so not a warning: said here because the MathML is the output asked for
            for a in result.applied.iter().filter(|a| a.rule == mathra::rules::S_MML_1) {
                eprintln!("mathra: note {}: {}", a.rule, a.description);
            }
            result.mathml
        }
        Mode::Text => result.text,
        Mode::Explain => {
            let mut s = format!(
                "input    {tex}\nlocale   {}\ntext     {}\nspeech   {}\nbraille  {} ({})\ntree     {}\n",
                args.locale,
                result.text,
                result.speech,
                result.braille,
                result.braille_code,
                result.tree.to_json()
            );
            if result.applied.is_empty() {
                s.push_str("rules    no rule changed the result\n");
            } else {
                s.push_str("rules\n");
                for a in &result.applied {
                    s.push_str(&format!("  {:<9} {}\n", a.rule, a.description));
                }
            }
            if !result.warnings.is_empty() {
                s.push_str("warnings\n");
                for a in &result.warnings {
                    s.push_str(&format!("  {:<9} {}\n", a.rule, a.description));
                }
            }
            print!("{s}");
            return ExitCode::SUCCESS;
        }
    };

    match args.output {
        Some(path) => {
            if let Err(e) = fs::write(&path, text) {
                eprintln!("mathra: could not write {path}: {e}");
                return ExitCode::from(1);
            }
        }
        None => println!("{text}"),
    }
    ExitCode::SUCCESS
}

fn batch(args: &Args) -> ExitCode {
    use std::io::{BufRead, Write};
    let mut options = args.options();
    let mut output = io::BufWriter::new(io::stdout().lock());
    for (i, line) in io::stdin().lock().split(b'\n').enumerate() {
        let Ok(bytes) = line else { break };
        let status = match String::from_utf8(bytes) {
            Err(_) => "error\tthe line is not UTF-8".to_string(),
            Ok(tex) => batch_status(&tex, i, args, &mut options),
        };
        let _ = writeln!(output, "{status}");
    }
    ExitCode::SUCCESS
}

/// Status of one batch line: `ok`, `warning<TAB>…` or `error<TAB>…`. The labels the line numbers
/// (`\label` with `\tag`) go into `options` for the lines after it, as in a document.
fn batch_status(tex: &str, i: usize, args: &Args, options: &mut Options) -> String {
    let tex = tex.strip_suffix('\r').unwrap_or(tex);
    let r = match convert(tex, options) {
        Ok(r) => r,
        Err(e) => return format!("error\t{e}"),
    };
    options.labels.extend(r.labels.clone());
    if let Some(folder) = &args.output {
        let (path, written) = if args.png {
            let path = format!("{folder}/{}.png", i + 1);
            let written = png(&r.svg, args).and_then(|bytes| fs::write(&path, bytes).map_err(|e| e.to_string()));
            (path, written)
        } else {
            let path = format!("{folder}/{}.svg", i + 1);
            let written = fs::write(&path, &r.svg).map_err(|e| e.to_string());
            (path, written)
        };
        if let Err(e) = written {
            return format!("error\tcould not write {path}: {e}");
        }
    }
    match r.warnings.first() {
        Some(a) => format!("warning\t{} {}", a.rule, a.description),
        None => "ok".to_string(),
    }
}
