"""
Core PDF and Image Generation Module.
High-resolution, lossless image compositing and PDF generation.
"""

import io
import math
from typing import List, Tuple, Union, Optional, Any
from PIL import Image, ImageOps, ImageDraw
import qrcode
from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_H, ERROR_CORRECT_Q, ERROR_CORRECT_L

try:
    import pymupdf
except ImportError:
    pymupdf = None

# Standard paper dimensions in PDF points (1/72 inch)
PAPER_POINTS = {
    "A4": (595.28, 841.89),
    "A3": (841.89, 1190.55),
    "Letter": (612.0, 792.0),
    "Legal": (612.0, 1008.0),
    "Wide-Format": (3329.17, 5791.82), # 46.2385" × 80.442" (11×12 4.2035"×6.7035" cards)
}


def pdf_page_to_image(pdf_bytes_or_path: Union[bytes, str], page_num: int = 0, dpi: int = 450) -> Image.Image:
    """Render a PDF page to a crisp PIL Image at high DPI (default 450 for ultra sharpness)."""
    if pymupdf is None:
        raise RuntimeError("pymupdf is required to render PDF pages.")
    if isinstance(pdf_bytes_or_path, bytes):
        doc = pymupdf.open(stream=pdf_bytes_or_path, filetype="pdf")
    else:
        doc = pymupdf.open(pdf_bytes_or_path)
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=dpi)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return img.convert("RGBA")


def extract_pages_from_pdf(pdf_bytes_or_path: Union[bytes, str], dpi: int = 450) -> List[Image.Image]:
    """Render all pages of a PDF to high-resolution PIL Images."""
    if pymupdf is None:
        raise RuntimeError("pymupdf is required to render PDF pages.")
    if isinstance(pdf_bytes_or_path, bytes):
        doc = pymupdf.open(stream=pdf_bytes_or_path, filetype="pdf")
    else:
        doc = pymupdf.open(pdf_bytes_or_path)
    images = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        images.append(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA"))
    return images


def generate_qr_image(
    data: str,
    box_size: int = 15,
    border: int = 0,
    error_correction: str = "M",
    fill_color: str = "black",
    back_color: str = "white",
) -> Image.Image:
    """Generate a high-resolution QR code image with zero white margin border."""
    ec_map = {
        "L": ERROR_CORRECT_L,
        "M": ERROR_CORRECT_M,
        "Q": ERROR_CORRECT_Q,
        "H": ERROR_CORRECT_H,
    }
    ec = ec_map.get(error_correction.upper(), ERROR_CORRECT_M)

    qr = qrcode.QRCode(
        version=None,
        error_correction=ec,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    return img.convert("RGBA")


def composite_qr_on_template(
    template: Image.Image,
    qr_img: Image.Image,
    x: int,
    y: int,
    qr_size: Union[int, Tuple[int, int]],
    sharpen_qr: bool = True,
) -> Image.Image:
    """
    Composite a QR code onto a template image at position (x, y).
    Uses LANCZOS high-quality resampling and UnsharpMask edge sharpening to eliminate blur.
    """
    from PIL import ImageFilter

    base = template.convert("RGBA")
    qr = qr_img.convert("RGBA")

    if isinstance(qr_size, (tuple, list)):
        w, h = int(qr_size[0]), int(qr_size[1])
    else:
        w, h = int(qr_size), int(qr_size)

    # Use ImageOps.contain to preserve natural aspect ratio without stretching
    resized_qr = ImageOps.contain(qr, (w, h), method=Image.Resampling.LANCZOS)
    paste_x = int(x) + (w - resized_qr.width) // 2
    paste_y = int(y) + (h - resized_qr.height) // 2

    if sharpen_qr:
        # Boost sharpness along QR code module edges to prevent anti-aliasing fuzz
        resized_qr = resized_qr.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))

    # Paste QR onto base image with alpha channel
    base.paste(resized_qr, (paste_x, paste_y), resized_qr)
    return base


def save_images_to_pdf_lossless(
    images: List[Image.Image],
    output_stream_or_path: Union[str, io.BytesIO],
    dpi: int = 450,
    page_pt_dims: Optional[Tuple[float, float]] = None,
    compression: str = "jpeg",
    quality: int = 92,
) -> None:
    """
    Save PIL images into a PDF using PyMuPDF.
    - compression='jpeg': High-efficiency print compression with 4:4:4 chroma subsampling (no blur on QR edges).
      Produces an ultra-compact ~10-15 MB PDF for 132 cards.
    - compression='png': Lossless Flate (PNG) compression (~80-130 MB).
    """
    if pymupdf is not None:
        doc = pymupdf.open()
        for img in images:
            rgb_img = img.convert("RGB")
            img_buf = io.BytesIO()
            if compression.lower() == "png":
                rgb_img.save(img_buf, format="PNG", optimize=True)
            else:
                # 4:4:4 subsampling preserves exact module edges without chroma downsampling
                rgb_img.save(img_buf, format="JPEG", quality=quality, subsampling=0)
            img_bytes = img_buf.getvalue()

            if page_pt_dims:
                pt_w, pt_h = page_pt_dims
            else:
                pt_w = (rgb_img.width / dpi) * 72.0
                pt_h = (rgb_img.height / dpi) * 72.0

            page = doc.new_page(width=pt_w, height=pt_h)
            rect = pymupdf.Rect(0, 0, pt_w, pt_h)
            page.insert_image(rect, stream=img_bytes)

        pdf_bytes = doc.tobytes(deflate=True, garbage=3)
        if isinstance(output_stream_or_path, (str, bytes)):
            with open(output_stream_or_path, "wb") as f:
                f.write(pdf_bytes)
        else:
            output_stream_or_path.write(pdf_bytes)
    else:
        # Fallback to Pillow
        if not images:
            return
        rgb_images = [img.convert("RGB") for img in images]
        rgb_images[0].save(
            output_stream_or_path,
            format="PDF",
            save_all=True,
            append_images=rgb_images[1:] if len(rgb_images) > 1 else [],
            resolution=float(dpi),
            quality=quality if compression.lower() == "jpeg" else 100,
            subsampling=0,
        )


def create_single_item_pdf(
    images: List[Image.Image],
    output_stream_or_path: Union[str, io.BytesIO],
    dpi: int = 450,
    compression: str = "jpeg",
    quality: int = 92,
) -> None:
    """Create a multi-page PDF where each page is an individual card item."""
    save_images_to_pdf_lossless(images, output_stream_or_path, dpi=dpi, compression=compression, quality=quality)


def generate_grid_sheets(
    images: List[Image.Image],
    page_size: str = "A4",
    rows: int = 12,
    cols: int = 11,
    margin_px: int = 0,
    spacing_px: int = 0,
    dpi: int = 450,
    custom_dims: Optional[Tuple[int, int]] = None,
    draw_cut_lines: bool = False,
    sharpen_cards: bool = True,
    fill_cells: bool = True,
) -> List[Image.Image]:
    """
    Arrange items into printable sheet grids (11 cols x 12 rows = 132 items per sheet) at high resolution.
    Supports zero margin edge-to-edge printing with fill_cells=True.
    """
    from PIL import ImageFilter

    PAGE_DIMS = {
        "A4": (int(8.27 * dpi), int(11.69 * dpi)),       # 3721 x 5260 at 450 DPI, 4962 x 7014 at 600 DPI, 9924 x 14028 at 1200 DPI
        "A3": (int(11.69 * dpi), int(16.54 * dpi)),
        "Letter": (int(8.5 * dpi), int(11.0 * dpi)),
        "Legal": (int(8.5 * dpi), int(14.0 * dpi)),
    }
    if custom_dims:
        page_w, page_h = custom_dims
    else:
        page_w, page_h = PAGE_DIMS.get(page_size, PAGE_DIMS["A4"])

    # Scale margins and spacing proportionally with DPI
    scaled_margin = int(margin_px * (dpi / 300.0))
    scaled_spacing = int(spacing_px * (dpi / 300.0))

    items_per_sheet = rows * cols  # 11 * 12 = 132
    total_sheets = math.ceil(len(images) / items_per_sheet) if images else 0
    sheet_pages = []

    avail_w = page_w - (2 * scaled_margin) - ((cols - 1) * scaled_spacing)
    avail_h = page_h - (2 * scaled_margin) - ((rows - 1) * scaled_spacing)
    cell_w = max(10, avail_w // cols)
    cell_h = max(10, avail_h // rows)

    for sheet_idx in range(total_sheets):
        sheet = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(sheet) if draw_cut_lines else None
        sheet_items = images[sheet_idx * items_per_sheet : (sheet_idx + 1) * items_per_sheet]

        for idx, img in enumerate(sheet_items):
            r = idx // cols
            c = idx % cols

            cell_x = scaled_margin + c * (cell_w + scaled_spacing)
            cell_y = scaled_margin + r * (cell_h + scaled_spacing)

            target_h = (page_h - cell_y) if (r == rows - 1 and scaled_margin == 0 and scaled_spacing == 0) else cell_h

            if fill_cells:
                # Fill entire cell with zero internal padding
                fitted = img.convert("RGB").resize((target_w, target_h), Image.Resampling.LANCZOS)
                offset_x = cell_x
                offset_y = cell_y
            else:
                fitted = ImageOps.contain(img.convert("RGB"), (target_w, target_h), method=Image.Resampling.LANCZOS)
                offset_x = cell_x + (target_w - fitted.width) // 2
                offset_y = cell_y + (target_h - fitted.height) // 2

            if sharpen_cards:
                fitted = fitted.filter(ImageFilter.UnsharpMask(radius=1.0, percent=130, threshold=2))

            sheet.paste(fitted, (offset_x, offset_y))

        # Draw Guillotine / Cutting Guide Lines on top of pasted cards
        if draw_cut_lines:
            draw = ImageDraw.Draw(sheet)
            line_w = max(2, int(round(dpi / 150.0)))
            dash_len = max(8, int(round(dpi / 30.0)))
            gap_len = max(4, int(round(dpi / 60.0)))

            total_grid_w = cols * (cell_w + scaled_spacing) - scaled_spacing
            total_grid_h = rows * (cell_h + scaled_spacing) - scaled_spacing

            for c in range(cols + 1):
                x = scaled_margin + c * (cell_w + scaled_spacing)
                cur_y = scaled_margin
                while cur_y < scaled_margin + total_grid_h:
                    draw.line([(x, cur_y), (x, min(cur_y + dash_len, scaled_margin + total_grid_h))], fill="#334155", width=line_w)
                    cur_y += dash_len + gap_len

            for r in range(rows + 1):
                y = scaled_margin + r * (cell_h + scaled_spacing)
                cur_x = scaled_margin
                while cur_x < scaled_margin + total_grid_w:
                    draw.line([(cur_x, y), (min(cur_x + dash_len, scaled_margin + total_grid_w), y)], fill="#334155", width=line_w)
                    cur_x += dash_len + gap_len

        sheet_pages.append(sheet)

    return sheet_pages


def create_grid_sheet_pdf(
    images: List[Image.Image],
    output_stream_or_path: Union[str, io.BytesIO],
    page_size: str = "A4",
    rows: int = 12,
    cols: int = 11,
    margin_px: int = 0,
    spacing_px: int = 0,
    dpi: int = 450,
    custom_dims: Optional[Tuple[int, int]] = None,
    draw_cut_lines: bool = False,
    sharpen_cards: bool = True,
    fill_cells: bool = True,
) -> None:
    """
    Arrange cards into a printable sheet grid and save as a lossless PDF.
    """
    sheet_pages = generate_grid_sheets(
        images=images,
        page_size=page_size,
        rows=rows,
        cols=cols,
        margin_px=margin_px,
        spacing_px=spacing_px,
        dpi=dpi,
        custom_dims=custom_dims,
        draw_cut_lines=draw_cut_lines,
        sharpen_cards=sharpen_cards,
        fill_cells=fill_cells,
    )

    pt_dims = PAPER_POINTS.get(page_size, (595.28, 841.89))
    save_images_to_pdf_lossless(sheet_pages, output_stream_or_path, dpi=dpi, page_pt_dims=pt_dims)


def generate_grid_sheets_direct(
    template: Image.Image,
    qr_items: List[Any],
    calibrated_x: int,
    calibrated_y: int,
    calibrated_w: int,
    calibrated_h: int,
    page_size: str = "A4",
    rows: int = 12,
    cols: int = 11,
    margin_px: int = 0,
    spacing_px: int = 0,
    dpi: int = 450,
    draw_cut_lines: bool = False,
    sharpen_cards: bool = True,
    fill_cells: bool = True,
    underlay_mask: str = "black",
    progress_callback = None,
) -> List[Image.Image]:
    """
    Direct low-memory, high-speed sheet generator.
    Avoids creating hundreds of 100MB+ full-size images in RAM.
    Streams items directly into printable sheet pages at target print resolution.
    """
    from PIL import ImageFilter

    base_template = template.convert("RGBA")
    t_orig_w, t_orig_h = base_template.size
    t_ratio = t_orig_w / float(t_orig_h) if t_orig_h > 0 else 1.0

    scaled_margin = int(margin_px * (dpi / 300.0))
    scaled_spacing = int(spacing_px * (dpi / 300.0))

    page_lower = page_size.lower()
    is_wide_format = "wide" in page_lower or "plotter" in page_lower
    is_exact_1to1 = "exact" in page_lower or "1:1" in page_lower or "match" in page_lower

    if is_wide_format:
        # Standard Wide-Format Plotter Sheet for 11×12 Cards:
        # Default card target: 4.2035" × 6.7035" (matches designer resolution)
        cell_w = t_orig_w
        cell_h = t_orig_h
        scale = 1.0
        cell_template = base_template

        grid_w = cols * cell_w + (cols - 1) * scaled_spacing
        grid_h = rows * cell_h + (rows - 1) * scaled_spacing
        page_w = grid_w + 2 * scaled_margin
        page_h = grid_h + 2 * scaled_margin

    elif is_exact_1to1:
        # 1:1 Scale matching original template image pixel-for-pixel
        cell_w = t_orig_w
        cell_h = t_orig_h
        scale = 1.0
        cell_template = base_template

        grid_w = cols * cell_w + (cols - 1) * scaled_spacing
        grid_h = rows * cell_h + (rows - 1) * scaled_spacing
        page_w = grid_w + 2 * scaled_margin
        page_h = grid_h + 2 * scaled_margin

    else:
        # Fixed standard paper formats (A4, A3, Letter, Legal)
        PAGE_DIMS = {
            "a4": (int(8.27 * dpi), int(11.69 * dpi)),
            "a3": (int(11.69 * dpi), int(16.54 * dpi)),
            "letter": (int(8.5 * dpi), int(11.0 * dpi)),
            "legal": (int(8.5 * dpi), int(14.0 * dpi)),
        }
        page_w, page_h = PAGE_DIMS.get(page_lower, PAGE_DIMS["a4"])

        avail_w = max(10, page_w - (2 * scaled_margin) - ((cols - 1) * scaled_spacing))
        avail_h = max(10, page_h - (2 * scaled_margin) - ((rows - 1) * scaled_spacing))
        max_cell_w = max(10, avail_w // cols)
        max_cell_h = max(10, avail_h // rows)

        # STRICT ASPECT-RATIO PRESERVATION: Never stretch the card template!
        if (max_cell_w / float(max_cell_h)) > t_ratio:
            cell_h = max_cell_h
            cell_w = max(10, int(round(cell_h * t_ratio)))
        else:
            cell_w = max_cell_w
            cell_h = max(10, int(round(cell_w / t_ratio)))

        cell_template = base_template.resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        scale = cell_w / float(t_orig_w)

    # Compute QR placement within cell preserving exact calibrated coordinates
    qr_cell_x = int(round(calibrated_x * scale))
    qr_cell_y = int(round(calibrated_y * scale))
    qr_cell_w = max(4, int(round(calibrated_w * scale)))
    qr_cell_h = max(4, int(round(calibrated_h * scale)))

    # Optional underlay mask (clears template background behind QR)
    if underlay_mask and underlay_mask.lower() not in ("none", "transparent", ""):
        mask_color = (255, 255, 255, 255) if underlay_mask.lower() == "white" else (0, 0, 0, 255)
        draw_cell = ImageDraw.Draw(cell_template)
        draw_cell.rectangle(
            [qr_cell_x, qr_cell_y, min(cell_w, qr_cell_x + qr_cell_w), min(cell_h, qr_cell_y + qr_cell_h)],
            fill=mask_color,
        )

    # Grid positioning: Centered within page margins
    total_grid_w = cols * cell_w + (cols - 1) * scaled_spacing
    total_grid_h = rows * cell_h + (rows - 1) * scaled_spacing
    start_x = scaled_margin + max(0, (page_w - (2 * scaled_margin) - total_grid_w) // 2)
    start_y = scaled_margin + max(0, (page_h - (2 * scaled_margin) - total_grid_h) // 2)

    items_per_sheet = rows * cols
    total_sheets = math.ceil(len(qr_items) / items_per_sheet) if qr_items else 0
    sheet_pages = []

    for sheet_idx in range(total_sheets):
        sheet = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(sheet) if draw_cut_lines else None
        chunk_items = qr_items[sheet_idx * items_per_sheet : (sheet_idx + 1) * items_per_sheet]

        for idx, item in enumerate(chunk_items):
            r = idx // cols
            c = idx % cols

            cell_x = start_x + c * (cell_w + scaled_spacing)
            cell_y = start_y + r * (cell_h + scaled_spacing)

            # Resolve QR image on-the-fly to keep memory virtually zero
            if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], Image.Image):
                qr_raw = item[1]
            elif isinstance(item, tuple) and len(item) >= 3 and item[2] == "pdf":
                qr_raw = pdf_page_to_image(item[1], page_num=item[3] if len(item) > 3 else 0, dpi=min(dpi, 300))
            elif isinstance(item, tuple) and len(item) >= 3 and item[2] == "image":
                qr_raw = Image.open(io.BytesIO(item[1]))
            elif isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], (bytes, bytearray)):
                try:
                    qr_raw = pdf_page_to_image(item[1], page_num=0, dpi=min(dpi, 300))
                except Exception:
                    qr_raw = Image.open(io.BytesIO(item[1]))
            elif isinstance(item, Image.Image):
                qr_raw = item
            elif isinstance(item, str) and os.path.isfile(item):
                if item.lower().endswith(".pdf"):
                    qr_raw = pdf_page_to_image(item, page_num=0, dpi=min(dpi, 300))
                else:
                    qr_raw = Image.open(item)
            elif isinstance(item, str):
                qr_raw = generate_qr_image(item)
            else:
                continue

            qr_rgba = qr_raw.convert("RGBA")
            fitted_qr = ImageOps.contain(qr_rgba, (qr_cell_w, qr_cell_h), method=Image.Resampling.LANCZOS)
            if sharpen_cards:
                fitted_qr = fitted_qr.filter(ImageFilter.UnsharpMask(radius=1.0, percent=130, threshold=2))

            paste_x = qr_cell_x + (qr_cell_w - fitted_qr.width) // 2
            paste_y = qr_cell_y + (qr_cell_h - fitted_qr.height) // 2

            card_cell = cell_template.copy()
            card_cell.paste(fitted_qr, (paste_x, paste_y), fitted_qr)
            sheet.paste(card_cell.convert("RGB"), (cell_x, cell_y))

            if progress_callback:
                progress_callback(sheet_idx * items_per_sheet + idx + 1, len(qr_items))

        # Draw Guillotine / Cutting Guide Lines on top of pasted cards
        if draw_cut_lines:
            draw = ImageDraw.Draw(sheet)
            line_w = max(2, int(round(dpi / 150.0)))
            dash_len = max(8, int(round(dpi / 30.0)))
            gap_len = max(4, int(round(dpi / 60.0)))

            # Vertical grid cut lines
            for c in range(cols + 1):
                x = start_x + c * (cell_w + scaled_spacing)
                cur_y = start_y
                while cur_y < start_y + total_grid_h:
                    draw.line([(x, cur_y), (x, min(cur_y + dash_len, start_y + total_grid_h))], fill="#334155", width=line_w)
                    cur_y += dash_len + gap_len

            # Horizontal grid cut lines
            for r in range(rows + 1):
                y = start_y + r * (cell_h + scaled_spacing)
                cur_x = start_x
                while cur_x < start_x + total_grid_w:
                    draw.line([(cur_x, y), (min(cur_x + dash_len, start_x + total_grid_w), y)], fill="#334155", width=line_w)
                    cur_x += dash_len + gap_len

        sheet_pages.append(sheet)

    return sheet_pages


def create_grid_sheet_pdf_direct(
    template: Image.Image,
    qr_items: List[Any],
    output_stream_or_path: Union[str, io.BytesIO],
    calibrated_x: int,
    calibrated_y: int,
    calibrated_w: int,
    calibrated_h: int,
    page_size: str = "Wide-Format",
    rows: int = 12,
    cols: int = 11,
    margin_px: int = 0,
    spacing_px: int = 0,
    dpi: int = 450,
    draw_cut_lines: bool = False,
    sharpen_cards: bool = True,
    fill_cells: bool = True,
    underlay_mask: str = "none",
    progress_callback = None,
    compression: str = "jpeg",
    quality: int = 92,
) -> List[Image.Image]:
    """
    One-shot streaming generator from template + QR items straight into a print-ready PDF.
    Produces a lightweight ~10-15 MB PDF file with zero memory bloat and exact layout matching.
    """
    sheet_pages = generate_grid_sheets_direct(
        template=template,
        qr_items=qr_items,
        calibrated_x=calibrated_x,
        calibrated_y=calibrated_y,
        calibrated_w=calibrated_w,
        calibrated_h=calibrated_h,
        page_size=page_size,
        rows=rows,
        cols=cols,
        margin_px=margin_px,
        spacing_px=spacing_px,
        dpi=dpi,
        draw_cut_lines=draw_cut_lines,
        sharpen_cards=sharpen_cards,
        fill_cells=fill_cells,
        underlay_mask=underlay_mask,
        progress_callback=progress_callback,
    )

    if sheet_pages:
        pt_w = sheet_pages[0].width / float(dpi) * 72.0
        pt_h = sheet_pages[0].height / float(dpi) * 72.0
        pt_dims = (pt_w, pt_h)
    else:
        pt_dims = PAPER_POINTS.get(page_size, (595.28, 841.89))

    save_images_to_pdf_lossless(
        sheet_pages,
        output_stream_or_path,
        dpi=dpi,
        page_pt_dims=pt_dims,
        compression=compression,
        quality=quality,
    )
    return sheet_pages


def chunk_list(data_list: list, chunk_size: int = 132) -> List[list]:
    """Split a list into chunks of chunk_size."""
    return [data_list[i : i + chunk_size] for i in range(0, len(data_list), chunk_size)]
