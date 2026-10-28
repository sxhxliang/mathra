//! cargo run -p mathra --example omml_docx -- target/equations.docx
//! The converter returns XML only; this example owns the minimal OPC/DOCX package.
use std::{fs::File, io::Write, path::PathBuf};
use zip::{write::FileOptions, ZipWriter};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = PathBuf::from(std::env::args_os().nth(1).unwrap_or_else(|| "target/equations.docx".into()));
    let equations = [
        r"x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}",
        r"\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}",
        r"\int_0^1 x^2\,dx = \frac{1}{3}",
        r"A = \begin{pmatrix}a & b \\ c & d\end{pmatrix}",
        r"\hat{x}_i + \sqrt[3]{y} + \mathbb{R}",
    ];
    let mut document = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body><w:p><w:r><w:t>Editable native Word equations</w:t></w:r></w:p>"#,
    );
    for source in equations {
        let omml = mathra::tex_to_omml(source)?;
        document.push_str(&format!("<w:p><m:oMathPara>{omml}</m:oMathPara></w:p>"));
    }
    document.push_str(r#"<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>"#);
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent)?;
    }
    let mut archive = ZipWriter::new(File::create(&path)?);
    for (name, contents) in [
        (
            "[Content_Types].xml",
            r#"<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"#,
        ),
        (
            "_rels/.rels",
            r#"<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"#,
        ),
        ("word/document.xml", document.as_str()),
    ] {
        archive.start_file(name, FileOptions::default().compression_method(zip::CompressionMethod::Stored))?;
        archive.write_all(contents.as_bytes())?;
    }
    archive.finish()?;
    println!("{}", path.display());
    Ok(())
}
