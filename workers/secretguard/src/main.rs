//! Bounded stdin-only pattern scanner. No subprocesses, file reads or networking.
use std::io::{self, Read};

const PREFIXES: &[(&str, usize, &str)] = &[
    ("ghp_", 36, "GitHub token"), ("github_pat_", 40, "GitHub fine-grained token"),
    ("AKIA", 16, "AWS access key ID"), ("sk_live_", 16, "Live service key"),
    ("xoxb-", 16, "Slack bot token"),
];
const PRIVATE: &[&str] = &["-----BEGIN PRIVATE KEY-----", "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----", "-----BEGIN OPENSSH PRIVATE KEY-----"];

fn scan(text: &str) -> Vec<(usize, &'static str, &'static str)> {
    let mut findings = Vec::new();
    for (i, line) in text.lines().enumerate() {
        for &(prefix, minimum, kind) in PREFIXES {
            if let Some(pos) = line.find(prefix) {
                let n = line[pos + prefix.len()..].chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').count();
                if n >= minimum { findings.push((i + 1, kind, "high")); }
            }
        }
        if PRIVATE.iter().any(|marker| line.contains(marker)) {
            findings.push((i + 1, "Private key material", "critical"));
        }
        if findings.len() >= 200 { break; }
    }
    findings.truncate(200);
    findings
}

fn main() {
    let mut bytes = Vec::new();
    if io::stdin().take(400_001).read_to_end(&mut bytes).is_err() || bytes.len() > 400_000 {
        eprintln!("input size/read limit"); std::process::exit(2);
    }
    let text = match std::str::from_utf8(&bytes) {
        Ok(s) => s, Err(_) => { eprintln!("UTF-8 required"); std::process::exit(2); }
    };
    // Every string below is a static label, never user content or secret values.
    let items: Vec<String> = scan(text).iter().map(|(line, kind, severity)|
        format!("{{\"line\":{line},\"kind\":\"{kind}\",\"severity\":\"{severity}\"}}")
    ).collect();
    println!("{{\"findings\":[{}],\"scanner\":\"rust\"}}", items.join(","));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn finds_known_marker() {
        let source = format!("سڵاو\nconst token = \"ghp_{}\";", "a".repeat(36));
        assert_eq!(scan(&source), vec![(2, "GitHub token", "high")]);
    }
    #[test] fn ignores_short_and_clean() { assert!(scan("ghp_short\nسڵاو دنیا").is_empty()); }
    #[test] fn finds_private_key_marker() { assert_eq!(scan("-----BEGIN PRIVATE KEY-----")[0].2, "critical"); }
    #[test] fn bounds_output() { assert_eq!(scan(&"-----BEGIN PRIVATE KEY-----\n".repeat(500)).len(), 200); }
}
