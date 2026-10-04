use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub source_path: String,
    pub total_files: usize,
    pub sample_files: Vec<String>,
    pub extensions: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitFolderParams {
    pub source_folder: String,
    pub destination_folder: Option<String>,
    pub batch_size: usize,
    pub naming_scheme: String, // "letter_only", "batch_letter", "batch_letter_range", "numbered"
    pub action: String,        // "copy" or "move"
    pub extension_filter: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFolderInfo {
    pub folder_name: String,
    pub folder_path: String,
    pub file_count: usize,
    pub start_index: usize,
    pub end_index: usize,
    pub sample_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitFolderResult {
    pub total_processed: usize,
    pub total_folders: usize,
    pub destination_root: String,
    pub batches: Vec<BatchFolderInfo>,
    pub errors: Vec<String>,
}

/// Generate letter naming: 0 -> A, 1 -> B ... 25 -> Z, 26 -> AA, 27 -> AB ...
pub fn get_letter_label(mut idx: usize) -> String {
    let mut result = String::new();
    loop {
        let rem = idx % 26;
        result.push((b'A' + rem as u8) as char);
        if idx < 26 {
            break;
        }
        idx = (idx / 26) - 1;
    }
    result.chars().rev().collect()
}

/// Natural sorting key extraction for correct numeric order (e.g. 2 before 10)
fn natural_sort_key(s: &str) -> Vec<(bool, String, u64)> {
    let mut chunks = Vec::new();
    let mut curr_str = String::new();
    let mut in_digit = false;

    for c in s.chars() {
        if c.is_ascii_digit() {
            if !in_digit && !curr_str.is_empty() {
                chunks.push((false, curr_str.to_lowercase(), 0));
                curr_str = String::new();
            }
            in_digit = true;
            curr_str.push(c);
        } else {
            if in_digit && !curr_str.is_empty() {
                let num = curr_str.parse::<u64>().unwrap_or(0);
                chunks.push((true, String::new(), num));
                curr_str = String::new();
            }
            in_digit = false;
            curr_str.push(c);
        }
    }

    if !curr_str.is_empty() {
        if in_digit {
            let num = curr_str.parse::<u64>().unwrap_or(0);
            chunks.push((true, String::new(), num));
        } else {
            chunks.push((false, curr_str.to_lowercase(), 0));
        }
    }

    chunks
}

/// Collect and naturally sort all regular files in a directory
fn get_sorted_files(
    dir: &Path,
    filter_exts: Option<&[String]>,
) -> Result<Vec<(String, PathBuf)>, String> {
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Directory does not exist: {}", dir.display()));
    }

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut file_list: Vec<(String, PathBuf)> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // Skip hidden or system files
            if file_name.starts_with('.') || file_name.eq_ignore_ascii_case("Thumbs.db") {
                continue;
            }

            if let Some(exts) = filter_exts {
                if !exts.is_empty() {
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if !exts.iter().any(|expected| expected.trim_start_matches('.').eq_ignore_ascii_case(&ext)) {
                        continue;
                    }
                }
            }

            file_list.push((file_name, path));
        }
    }

    // Sort naturally
    file_list.sort_by(|a, b| {
        let key_a = natural_sort_key(&a.0);
        let key_b = natural_sort_key(&b.0);
        key_a.cmp(&key_b)
    });

    Ok(file_list)
}

pub fn scan_folder_impl(folder_path: &str) -> Result<ScanResult, String> {
    let path = Path::new(folder_path);
    let files = get_sorted_files(path, None)?;

    let total_files = files.len();
    let mut extensions: HashMap<String, usize> = HashMap::new();

    for (name, _) in &files {
        let ext = Path::new(name)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| "none".to_string());
        *extensions.entry(ext).or_insert(0) += 1;
    }

    let sample_files = files
        .iter()
        .take(30)
        .map(|(name, _)| name.clone())
        .collect();

    Ok(ScanResult {
        source_path: folder_path.to_string(),
        total_files,
        sample_files,
        extensions,
    })
}

pub fn split_folder_impl(params: SplitFolderParams) -> Result<SplitFolderResult, String> {
    let source_dir = Path::new(&params.source_folder);
    if !source_dir.is_dir() {
        return Err("Source path is not a valid directory".to_string());
    }

    let batch_size = if params.batch_size == 0 {
        132
    } else {
        params.batch_size
    };

    let files = get_sorted_files(source_dir, params.extension_filter.as_deref())?;
    if files.is_empty() {
        return Err("No matching files found in the source directory".to_string());
    }

    // Determine target root
    let dest_root = if let Some(ref dest) = params.destination_folder {
        PathBuf::from(dest)
    } else {
        source_dir.join(format!("Batches_{}", batch_size))
    };

    fs::create_dir_all(&dest_root)
        .map_err(|e| format!("Failed to create destination directory {}: {}", dest_root.display(), e))?;

    let is_move = params.action.eq_ignore_ascii_case("move");
    let mut batches = Vec::new();
    let mut errors = Vec::new();
    let mut processed_count = 0;

    let chunks: Vec<&[(String, PathBuf)]> = files.chunks(batch_size).collect();
    let total_batches = chunks.len();

    for (b_idx, chunk) in chunks.iter().enumerate() {
        let letter = get_letter_label(b_idx);
        let start_num = b_idx * batch_size + 1;
        let end_num = start_num + chunk.len() - 1;

        let folder_name = match params.naming_scheme.as_str() {
            "letter_only" => letter.clone(),
            "batch_letter" => format!("Batch_{}", letter),
            "batch_letter_range" => format!("Folder_{} ({}-{})", letter, start_num, end_num),
            "numbered" => {
                let pad = if total_batches >= 100 { 3 } else { 2 };
                format!("Batch_{:0width$}", b_idx + 1, width = pad)
            }
            _ => format!("Folder_{}", letter),
        };

        let target_folder_path = dest_root.join(&folder_name);
        if let Err(e) = fs::create_dir_all(&target_folder_path) {
            errors.push(format!("Failed to create folder {}: {}", target_folder_path.display(), e));
            continue;
        }

        let mut samples = Vec::new();

        for (file_name, source_file_path) in chunk.iter() {
            let dest_file_path = target_folder_path.join(file_name);

            if samples.len() < 5 {
                samples.push(file_name.clone());
            }

            if is_move {
                if let Err(_e) = fs::rename(source_file_path, &dest_file_path) {
                    // Fallback to copy + remove in case of cross-filesystem moves
                    if let Err(copy_err) = fs::copy(source_file_path, &dest_file_path) {
                        errors.push(format!("Failed to move {}: {}", file_name, copy_err));
                    } else {
                        let _ = fs::remove_file(source_file_path);
                        processed_count += 1;
                    }
                } else {
                    processed_count += 1;
                }
            } else {
                if let Err(e) = fs::copy(source_file_path, &dest_file_path) {
                    errors.push(format!("Failed to copy {}: {}", file_name, e));
                } else {
                    processed_count += 1;
                }
            }
        }

        batches.push(BatchFolderInfo {
            folder_name,
            folder_path: target_folder_path.to_string_lossy().to_string(),
            file_count: chunk.len(),
            start_index: start_num,
            end_index: end_num,
            sample_files: samples,
        });
    }

    Ok(SplitFolderResult {
        total_processed: processed_count,
        total_folders: batches.len(),
        destination_root: dest_root.to_string_lossy().to_string(),
        batches,
        errors,
    })
}

pub fn open_folder_impl(folder_path: &str) -> Result<(), String> {
    let path = Path::new(folder_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder on macOS: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        let win_path = folder_path.replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(&win_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder on Windows: {}", e))?;
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
