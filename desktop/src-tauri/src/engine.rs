use base64::prelude::*;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use image::{imageops, ImageBuffer, Rgb, RgbImage, RgbaImage};
use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;

fn decode_image_data(data_uri_or_base64: &str) -> Result<RgbaImage, String> {
    let b64 = if let Some(comma_pos) = data_uri_or_base64.find(',') {
        &data_uri_or_base64[comma_pos + 1..]
    } else {
        data_uri_or_base64
    };
    let bytes = BASE64_STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Image load from memory error: {}", e))?;
    Ok(img.to_rgba8())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridConfig {
    pub cols: u32,
    pub rows: u32,
    pub dpi: u32,
    #[serde(rename = "paperFormat")]
    pub paper_format: String,
    pub orientation: String,
    #[serde(rename = "marginLeftMm")]
    pub margin_left_mm: f64,
    #[serde(rename = "marginRightMm")]
    pub margin_right_mm: f64,
    #[serde(rename = "marginTopMm")]
    pub margin_top_mm: f64,
    #[serde(rename = "marginBottomMm")]
    pub margin_bottom_mm: f64,
    #[serde(rename = "spacingHorizontalMm")]
    pub spacing_horizontal_mm: f64,
    #[serde(rename = "spacingVerticalMm")]
    pub spacing_vertical_mm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateJob {
    pub grid: GridConfig,
    #[serde(rename = "qrBox")]
    pub qr_box: BoundingBox,
    #[serde(rename = "templatePath")]
    pub template_path: Option<String>,
    #[serde(rename = "templateData")]
    pub template_data: Option<String>,
    #[serde(rename = "compositeCardData")]
    pub composite_card_data: Option<String>,
    #[serde(rename = "qrData")]
    pub qr_data: Option<String>,
    #[serde(rename = "qrFilePaths")]
    pub qr_file_paths: Option<Vec<String>>,
    #[serde(rename = "qrDataList")]
    pub qr_data_list: Option<Vec<String>>,
    #[serde(rename = "folderPath")]
    pub folder_path: Option<String>,
    #[serde(rename = "outputPath")]
    pub output_path: Option<String>,
    #[serde(rename = "unsharpMask")]
    pub unsharp_mask: bool,
    pub lossless: bool,
    #[serde(rename = "totalItems")]
    pub total_items: Option<usize>,
    #[serde(rename = "overlayBackground")]
    pub overlay_background: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResult {
    pub success: bool,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(rename = "totalPages")]
    pub total_pages: usize,
    #[serde(rename = "totalBadges")]
    pub total_badges: usize,
    #[serde(rename = "pdfBase64")]
    pub pdf_base64: Option<String>,
}

/// Computes paper dimensions in millimeters and PDF points
fn get_paper_dims(format: &str, orientation: &str) -> (f64, f64, f64, f64) {
    let (base_w_mm, base_h_mm) = match format.to_lowercase().as_str() {
        "letter" => (215.9, 279.4),
        "a3" => (297.0, 420.0),
        "legal" => (215.9, 355.6),
        f if f.contains("46.2") || f.contains("roll") => (46.2 * 25.4, 80.4444 * 25.4),
        _ => (210.0, 297.0), // A4 default
    };

    let (w_mm, h_mm) = if orientation.to_lowercase() == "landscape" {
        (base_h_mm, base_w_mm)
    } else {
        (base_w_mm, base_h_mm)
    };

    // 1 inch = 25.4 mm = 72 PDF points
    let pt_w = (w_mm / 25.4) * 72.0;
    let pt_h = (h_mm / 25.4) * 72.0;

    (w_mm, h_mm, pt_w, pt_h)
}

/// Applies a crisp sharpening mask to enhance contrast of QR code modules
fn apply_qr_sharpen(img: &mut RgbaImage) {
    // Unsharp mask via high-contrast edge enhancement
    let (width, height) = img.dimensions();
    let original = img.clone();

    for y in 1..(height.saturating_sub(1)) {
        for x in 1..(width.saturating_sub(1)) {
            let p_center = original.get_pixel(x, y);
            if p_center[3] == 0 {
                continue;
            }

            // Sample 4 cross-neighbors
            let p_top = original.get_pixel(x, y - 1);
            let p_bottom = original.get_pixel(x, y + 1);
            let p_left = original.get_pixel(x - 1, y);
            let p_right = original.get_pixel(x + 1, y);

            let mut out = [0u8; 4];
            for c in 0..3 {
                let center_val = p_center[c] as f32;
                let surround_avg =
                    (p_top[c] as f32 + p_bottom[c] as f32 + p_left[c] as f32 + p_right[c] as f32) / 4.0;
                let diff = center_val - surround_avg;
                // Sharpen factor 1.3
                let sharpened = center_val + diff * 0.35;
                out[c] = sharpened.clamp(0.0, 255.0) as u8;
            }
            out[3] = p_center[3];
            img.put_pixel(x, y, image::Rgba(out));
        }
    }
}

/// Generates a fallback pro badge image buffer if no custom template was supplied
fn generate_default_badge(width: u32, height: u32) -> RgbaImage {
    let mut img = ImageBuffer::from_pixel(width, height, image::Rgba([15, 23, 42, 255]));

    // Draw card border
    let border_thick = (width.min(height) as f32 * 0.02).max(1.0) as u32;
    for y in 0..height {
        for x in 0..width {
            if x < border_thick
                || x >= width - border_thick
                || y < border_thick
                || y >= height - border_thick
            {
                img.put_pixel(x, y, image::Rgba([67, 56, 202, 255]));
            }
        }
    }

    img
}

/// Generates a sample crisp QR code if none provided
fn generate_sample_qr(width: u32, height: u32) -> RgbaImage {
    let mut img = ImageBuffer::from_pixel(width, height, image::Rgba([255, 255, 255, 255]));
    let size = width.min(height);
    let cell_size = (size / 21).max(1);

    // Draw position finder patterns
    let draw_finder = |target: &mut RgbaImage, start_x: u32, start_y: u32| {
        for r in 0..7 {
            for c in 0..7 {
                let is_black = r == 0
                    || r == 6
                    || c == 0
                    || c == 6
                    || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                let color = if is_black {
                    image::Rgba([0, 0, 0, 255])
                } else {
                    image::Rgba([255, 255, 255, 255])
                };
                for dy in 0..cell_size {
                    for dx in 0..cell_size {
                        let px = start_x + c * cell_size + dx;
                        let py = start_y + r * cell_size + dy;
                        if px < target.width() && py < target.height() {
                            target.put_pixel(px, py, color);
                        }
                    }
                }
            }
        }
    };

    draw_finder(&mut img, 0, 0);
    draw_finder(&mut img, size - 7 * cell_size, 0);
    draw_finder(&mut img, 0, size - 7 * cell_size);

    // Fill some interior dummy timing & alignment patterns
    for r in 0..21 {
        for c in 0..21 {
            if (r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8) {
                continue;
            }
            if (r * 7 + c * 13 + 5) % 3 == 0 {
                for dy in 0..cell_size {
                    for dx in 0..cell_size {
                        let px = c * cell_size + dx;
                        let py = r * cell_size + dy;
                        if px < img.width() && py < img.height() {
                            img.put_pixel(px, py, image::Rgba([0, 0, 0, 255]));
                        }
                    }
                }
            }
        }
    }

    img
}

/// Core function to execute PDF generation
pub fn process_pdf_generation(job: GenerateJob) -> Result<GenerateResult, String> {
    let (w_mm, h_mm, pt_w, pt_h) = get_paper_dims(&job.grid.paper_format, &job.grid.orientation);
    let is_large_format = w_mm > 800.0 || h_mm > 1500.0;
    let dpi = if is_large_format {
        job.grid.dpi.min(300).max(150)
    } else {
        job.grid.dpi.max(150)
    };

    // Calculate exact pixel dimensions for target page at specified DPI
    let page_px_w = ((w_mm / 25.4) * (dpi as f64)).round() as u32;
    let page_px_h = ((h_mm / 25.4) * (dpi as f64)).round() as u32;

    let margin_l_px = ((job.grid.margin_left_mm / 25.4) * (dpi as f64)).round() as u32;
    let margin_r_px = ((job.grid.margin_right_mm / 25.4) * (dpi as f64)).round() as u32;
    let margin_t_px = ((job.grid.margin_top_mm / 25.4) * (dpi as f64)).round() as u32;
    let margin_b_px = ((job.grid.margin_bottom_mm / 25.4) * (dpi as f64)).round() as u32;

    let spacing_h_px = ((job.grid.spacing_horizontal_mm / 25.4) * (dpi as f64)).round() as u32;
    let spacing_v_px = ((job.grid.spacing_vertical_mm / 25.4) * (dpi as f64)).round() as u32;

    let cols = job.grid.cols.max(1);
    let rows = job.grid.rows.max(1);
    let items_per_page = (cols * rows) as usize;

    let avail_w = page_px_w
        .saturating_sub(margin_l_px + margin_r_px + (cols - 1) * spacing_h_px);
    let avail_h = page_px_h
        .saturating_sub(margin_t_px + margin_b_px + (rows - 1) * spacing_v_px);

    let cell_w = (avail_w / cols).max(10);
    let cell_h = (avail_h / rows).max(10);

    // Pre-decode composite card if provided
    let composite_card_base = if let Some(ref data) = job.composite_card_data {
        decode_image_data(data).ok()
    } else {
        None
    };

    let (cell_w, cell_h, page_px_w, page_px_h, pt_w, pt_h) = if cols == 1 && rows == 1 {
        if let Some(ref comp) = composite_card_base {
            let pw = comp.width();
            let ph = comp.height();
            let ptw = (pw as f64 / 300.0) * 72.0;
            let pth = (ph as f64 / 300.0) * 72.0;
            (pw, ph, pw, ph, ptw, pth)
        } else {
            (cell_w, cell_h, page_px_w, page_px_h, pt_w, pt_h)
        }
    } else {
        (cell_w, cell_h, page_px_w, page_px_h, pt_w, pt_h)
    };

    // Load template image:
    // 1. template_data (base64 from frontend)
    // 2. template_path (file on disk)
    // 3. fallback to generate_default_badge
    let template_base = if let Some(ref data) = job.template_data {
        decode_image_data(data).unwrap_or_else(|_| generate_default_badge(cell_w, cell_h))
    } else if let Some(ref path) = job.template_path {
        if Path::new(path).exists() {
            image::open(path)
                .map_err(|e| format!("Failed to open template image: {}", e))?
                .to_rgba8()
        } else {
            generate_default_badge(cell_w, cell_h)
        }
    } else {
        generate_default_badge(cell_w, cell_h)
    };

    // Pre-scale template to cell dimensions using high quality Lanczos3 filter
    let cell_template = if template_base.width() == cell_w && template_base.height() == cell_h {
        template_base
    } else {
        imageops::resize(&template_base, cell_w, cell_h, imageops::FilterType::Lanczos3)
    };

    // Pre-scale composite card if available
    let cell_composite = composite_card_base.map(|c| {
        if c.width() == cell_w && c.height() == cell_h {
            c
        } else {
            imageops::resize(&c, cell_w, cell_h, imageops::FilterType::Lanczos3)
        }
    });

    // Calculate QR placement bounding box inside the cell
    let qr_box_w = ((cell_w as f64) * (job.qr_box.width / 100.0)).round() as u32;
    let qr_box_h = ((cell_h as f64) * (job.qr_box.height / 100.0)).round() as u32;
    let qr_box_x = ((cell_w as f64) * (job.qr_box.x / 100.0)).round() as u32;
    let qr_box_y = ((cell_h as f64) * (job.qr_box.y / 100.0)).round() as u32;

    // Determine QR sources
    let mut resolved_qr_paths = job.qr_file_paths.clone().unwrap_or_default();
    if let Some(ref dir_path) = job.folder_path {
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "png" || ext_lower == "jpg" || ext_lower == "jpeg" || ext_lower == "webp" {
                        resolved_qr_paths.push(p.to_string_lossy().to_string());
                    }
                }
            }
            resolved_qr_paths.sort();
        }
    }

    let is_single_qr = resolved_qr_paths.len() == 1
        || (resolved_qr_paths.is_empty() && job.qr_data_list.as_ref().map_or(true, |l| l.len() <= 1));

    let total_badges = if !resolved_qr_paths.is_empty() && !is_single_qr {
        resolved_qr_paths.len()
    } else if let Some(ref list) = job.qr_data_list {
        if list.len() > 1 {
            list.len()
        } else {
            job.total_items.unwrap_or(items_per_page)
        }
    } else {
        job.total_items.unwrap_or(items_per_page)
    };

    let total_pages = (total_badges + items_per_page - 1) / items_per_page;

    // Destination output path
    let output_path = job.output_path.unwrap_or_else(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        let desktop = Path::new(&home).join("Desktop");

        let default_name = if cols == 1 && rows == 1 {
            "combo_sample.pdf"
        } else {
            "printable_grid_output.pdf"
        };

        if desktop.exists() {
            desktop.join(default_name).to_string_lossy().into()
        } else {
            default_name.into()
        }
    });

    // Initialize PDF Document
    let mut pdf = Pdf::new();
    let catalog_ref = Ref::new(1);
    let pages_ref = Ref::new(2);

    let mut page_refs = Vec::new();
    let mut image_refs = Vec::new();

    let mut next_ref = 3;
    for _ in 0..total_pages {
        page_refs.push(Ref::new(next_ref));
        next_ref += 1;
        image_refs.push(Ref::new(next_ref));
        next_ref += 1;
    }

    // Catalog
    pdf.catalog(catalog_ref).pages(pages_ref);

    // Pages Tree
    let mut pages = pdf.pages(pages_ref);
    pages.kids(page_refs.iter().copied());
    pages.count(total_pages as i32);
    pages.finish();

    // Generate each page
    for page_idx in 0..total_pages {
        let page_ref = page_refs[page_idx];
        let image_ref = image_refs[page_idx];

        // Create blank white page canvas
        let mut page_canvas: RgbImage = ImageBuffer::from_pixel(page_px_w, page_px_h, Rgb([255, 255, 255]));

        let start_idx = page_idx * items_per_page;
        let end_idx = (start_idx + items_per_page).min(total_badges);

        for badge_idx in start_idx..end_idx {
            let local_idx = (badge_idx - start_idx) as u32;
            let col = local_idx % cols;
            let row = local_idx / cols;

            let cell_x0 = margin_l_px + col * (cell_w + spacing_h_px);
            let cell_y0 = margin_t_px + row * (cell_h + spacing_v_px);

            // Compute actual cell width/height to eliminate 1-px rounding gap on last row/col (Full Bleed)
            let actual_cell_w = if col == cols - 1 {
                page_px_w.saturating_sub(margin_r_px + cell_x0).min(cell_w + 2)
            } else {
                cell_w
            };
            let actual_cell_h = if row == rows - 1 {
                page_px_h.saturating_sub(margin_b_px + cell_y0).min(cell_h + 2)
            } else {
                cell_h
            };

            let has_multi_qr = !resolved_qr_paths.is_empty()
                || job.qr_data_list.as_ref().map_or(false, |l| l.len() > 1);

            let cell_img = if let (Some(ref comp), false) = (&cell_composite, has_multi_qr) {
                comp.clone()
            } else {
                let mut base = cell_template.clone();

                let qr_target_path = if is_single_qr && !resolved_qr_paths.is_empty() {
                    Some(&resolved_qr_paths[0])
                } else if badge_idx < resolved_qr_paths.len() {
                    Some(&resolved_qr_paths[badge_idx])
                } else {
                    None
                };

                let qr_img_raw = if let Some(ref list) = job.qr_data_list {
                    if !list.is_empty() {
                        let idx = if is_single_qr { 0 } else { badge_idx.min(list.len() - 1) };
                        decode_image_data(&list[idx]).ok()
                    } else {
                        None
                    }
                } else if let Some(ref data) = job.qr_data {
                    decode_image_data(data).ok()
                } else if let Some(path) = qr_target_path {
                    if Path::new(path).exists() {
                        image::open(path).ok().map(|i| i.to_rgba8())
                    } else {
                        None
                    }
                } else {
                    None
                };

                let mut qr_img = match qr_img_raw {
                    Some(q) => imageops::resize(&q, qr_box_w, qr_box_h, imageops::FilterType::Lanczos3),
                    None => generate_sample_qr(qr_box_w, qr_box_h),
                };

                if job.unsharp_mask {
                    apply_qr_sharpen(&mut qr_img);
                }

                if let Some(ref bg) = job.overlay_background {
                    let fill_color = match bg.to_lowercase().as_str() {
                        "white" => Some(image::Rgba([255, 255, 255, 255])),
                        "black" => Some(image::Rgba([0, 0, 0, 255])),
                        "transparent" | "none" => None,
                        hex if hex.starts_with('#') => Some(parse_hex_color(hex)),
                        _ => Some(image::Rgba([0, 0, 0, 255])),
                    };
                    if let Some(fc) = fill_color {
                        for by in qr_box_y..(qr_box_y + qr_box_h).min(base.height()) {
                            for bx in qr_box_x..(qr_box_x + qr_box_w).min(base.width()) {
                                base.put_pixel(bx, by, fc);
                            }
                        }
                    }
                }

                imageops::overlay(&mut base, &qr_img, qr_box_x as i64, qr_box_y as i64);
                base
            };

            // Copy cell pixels into page canvas
            for cy in 0..actual_cell_h.min(cell_img.height()) {
                for cx in 0..actual_cell_w.min(cell_img.width()) {
                    let px = cell_x0 + cx;
                    let py = cell_y0 + cy;
                    if px < page_px_w && py < page_px_h {
                        let rgba = cell_img.get_pixel(cx, cy);
                        page_canvas.put_pixel(px, py, Rgb([rgba[0], rgba[1], rgba[2]]));
                    }
                }
            }
        }

        // Compress page image losslessly with FlateDecode (zlib deflate) - using fast compression for high throughput
        let raw_rgb = page_canvas.into_raw();
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
        encoder
            .write_all(&raw_rgb)
            .map_err(|e| format!("Deflate compression error: {}", e))?;
        let compressed_data = encoder
            .finish()
            .map_err(|e| format!("Deflate finish error: {}", e))?;

        // Write Image XObject
        let image_name = Name(b"Im0");
        let mut img_obj = pdf.image_xobject(image_ref, &compressed_data);
        img_obj.filter(pdf_writer::Filter::FlateDecode);
        img_obj.width(page_px_w as i32);
        img_obj.height(page_px_h as i32);
        img_obj.color_space().device_rgb();
        img_obj.bits_per_component(8);
        img_obj.finish();

        // Write Page Object
        let mut page = pdf.page(page_ref);
        page.media_box(Rect::new(0.0, 0.0, pt_w as f32, pt_h as f32));
        page.parent(pages_ref);

        // Content stream to draw image full bleed
        let mut content = Content::new();
        content.save_state();
        // Scale to fill full page points
        content.transform([pt_w as f32, 0.0, 0.0, pt_h as f32, 0.0, 0.0]);
        content.x_object(image_name);
        content.restore_state();

        let content_stream = content.finish();
        let content_ref = Ref::new(next_ref);
        next_ref += 1;

        page.contents(content_ref);

        // Add resource dictionary
        let mut resources = page.resources();
        resources.x_objects().pair(image_name, image_ref);
        resources.finish();
        page.finish();

        // Write content stream
        pdf.stream(content_ref, &content_stream);
    }

    // Write completed PDF file
    let pdf_bytes = pdf.finish();
    let mut file = File::create(&output_path)
        .map_err(|e| format!("Failed to create output PDF file at {}: {}", output_path, e))?;
    file.write_all(&pdf_bytes)
        .map_err(|e| format!("Failed to write PDF data: {}", e))?;

    let pdf_base64 = BASE64_STANDARD.encode(&pdf_bytes);

    Ok(GenerateResult {
        success: true,
        output_path,
        total_pages,
        total_badges,
        pdf_base64: Some(pdf_base64),
    })
}

fn parse_hex_color(hex: &str) -> image::Rgba<u8> {
    let clean = hex.trim_start_matches('#');
    if clean.len() >= 6 {
        let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0);
        image::Rgba([r, g, b, 255])
    } else {
        image::Rgba([0, 0, 0, 255])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_11x12_grid_pdf_generation() {
        let job = GenerateJob {
            grid: GridConfig {
                cols: 11,
                rows: 12,
                dpi: 300, // fast test at 300 DPI
                paper_format: "A4".into(),
                orientation: "portrait".into(),
                margin_left_mm: 0.0,
                margin_right_mm: 0.0,
                margin_top_mm: 0.0,
                margin_bottom_mm: 0.0,
                spacing_horizontal_mm: 0.0,
                spacing_vertical_mm: 0.0,
            },
            qr_box: BoundingBox {
                x: 20.0,
                y: 25.0,
                width: 60.0,
                height: 50.0,
            },
            template_path: None,
            template_data: None,
            composite_card_data: None,
            qr_data: None,
            qr_file_paths: None,
            qr_data_list: None,
            folder_path: None,
            output_path: Some(std::env::temp_dir().join("test_11x12_output.pdf").to_string_lossy().into()),

            unsharp_mask: true,
            lossless: true,
            total_items: Some(132),
            overlay_background: None,
        };

        let result = process_pdf_generation(job).expect("PDF generation should succeed");
        assert!(result.success);
        assert_eq!(result.total_pages, 1);
        assert_eq!(result.total_badges, 132);
        assert!(Path::new(&result.output_path).exists());

        let metadata = std::fs::metadata(&result.output_path).unwrap();
        assert!(metadata.len() > 1000, "PDF file should have valid non-empty content");
    }
}

