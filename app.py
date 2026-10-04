"""
Batch QR & Template PDF Generator - Streamlit GUI
Supports interactive visual drag-and-scale box, PDF & Image templates,
multiple PDF file uploads, and Ultra-HD 11 Columns x 12 Rows (132 items per page) printable grid PDF generation.
"""

import io
import os
import zipfile
import glob
import pandas as pd
import streamlit as st
from PIL import Image
from streamlit_cropper import st_cropper

import pdf_generator

st.set_page_config(
    page_title="QR Studio — Print Layout",
    page_icon="■",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.sidebar.markdown("### Output Quality & File Size")
pdf_compression_mode = st.sidebar.radio(
    "Target PDF File Size:",
    options=[
        "Compact Print (~10-15 MB, High-Res 4:4:4)",
        "Standard Print (~4-8 MB, 300 DPI)",
        "Uncompressed Raw (~80-130 MB, Lossless PNG)",
    ],
    index=0,
    help="Compact Print produces a crisp ~10-15 MB PDF file with 4:4:4 chroma subsampling (zero blur on QR modules). Perfect for emailing and print shops.",
)

if "Compact" in pdf_compression_mode:
    pdf_comp_type = "jpeg"
    pdf_quality = 92
    selected_dpi = 450
elif "Standard" in pdf_compression_mode:
    pdf_comp_type = "jpeg"
    pdf_quality = 85
    selected_dpi = 300
else:
    pdf_comp_type = "png"
    pdf_quality = 100
    selected_dpi = 450

with st.sidebar.expander("⚙️ Advanced Resolution Override", expanded=False):
    dpi_override = st.selectbox(
        "Custom DPI:",
        options=[
            "Keep Recommended Setting",
            "600 DPI (Ultra Sharp)",
            "450 DPI (Sharp)",
            "300 DPI (Standard)",
        ],
        index=0,
    )
    if "600" in dpi_override:
        selected_dpi = 600
    elif "450" in dpi_override:
        selected_dpi = 450
    elif "300" in dpi_override:
        selected_dpi = 300

enable_sharpening = st.sidebar.checkbox(
    "Unsharp Mask Filter",
    value=True,
    help="Preserves clean high-contrast edges on QR modules.",
)

st.sidebar.markdown("### Grid Layout")
g_c1, g_c2 = st.sidebar.columns(2)
with g_c1:
    grid_cols = st.number_input("Columns", min_value=1, max_value=50, value=11, step=1)
with g_c2:
    grid_rows = st.number_input("Rows", min_value=1, max_value=50, value=12, step=1)

items_per_page = int(grid_cols * grid_rows)
st.sidebar.caption(f"{grid_cols} cols × {grid_rows} rows ({items_per_page} items per page)")

paper_options = [
    "Wide-Format (46.2\" × 80.44\" — 11×12 Cards)",
    "Match Template Layout (1:1 Exact Scale)",
    "A4",
    "A3",
    "Letter",
    "Legal",
]
page_paper = st.sidebar.selectbox("Paper Format", paper_options, index=0)
margin_px = st.sidebar.slider("Page Margin (px)", min_value=0, max_value=150, value=0, step=5)
spacing_px = st.sidebar.slider("Card Spacing (px)", min_value=0, max_value=50, value=0, step=2)
fill_cells = st.sidebar.checkbox("Full Bleed (Edge-to-Edge)", value=True)
draw_guides = st.sidebar.checkbox("Cut guides", value=False)

st.markdown("## QR Studio")
st.caption(
    f"Interactive layout compositor for print-ready PDFs — {grid_cols}×{grid_rows} grid ({items_per_page} items/page), full bleed."
)

tab_single, tab_batch = st.tabs(["Layout & Calibration", f"Batch Generation ({items_per_page} / Page)"])


def load_as_image(uploaded_file, page_num=0, dpi=450):
    """Safely convert uploaded image or PDF to PIL Image at high DPI."""
    if uploaded_file is None:
        return None
    file_bytes = uploaded_file.getvalue()
    name_lower = uploaded_file.name.lower()
    if name_lower.endswith(".pdf"):
        return pdf_generator.pdf_page_to_image(file_bytes, page_num=page_num, dpi=dpi)
    else:
        return Image.open(io.BytesIO(file_bytes)).convert("RGBA")


def get_qr_image_from_item(item, dpi=300):
    """Safely extracts a PIL image from any supported QR item format for preview or single export."""
    if item is None:
        return None
    if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], Image.Image):
        return item[1]
    elif isinstance(item, tuple) and len(item) >= 3 and item[2] == "pdf":
        return pdf_generator.pdf_page_to_image(item[1], page_num=item[3] if len(item) > 3 else 0, dpi=dpi)
    elif isinstance(item, tuple) and len(item) >= 3 and item[2] == "image":
        return Image.open(io.BytesIO(item[1])).convert("RGBA")
    elif isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], (bytes, bytearray)):
        try:
            return pdf_generator.pdf_page_to_image(item[1], page_num=0, dpi=dpi)
        except Exception:
            return Image.open(io.BytesIO(item[1])).convert("RGBA")
    elif isinstance(item, Image.Image):
        return item
    elif isinstance(item, str) and os.path.isfile(item):
        if item.lower().endswith(".pdf"):
            return pdf_generator.pdf_page_to_image(item, page_num=0, dpi=dpi)
        else:
            return Image.open(item).convert("RGBA")
    elif isinstance(item, str):
        return pdf_generator.generate_qr_image(item)
    return None


def parse_uploaded_qr_files(file_list, dpi=300):
    """
    Parse uploaded files into lightweight items (storing raw bytes rather than 10GB of uncompressed bitmaps).
    Enables instant loading and prevents memory exhaustion when 100+ files are imported.
    """
    items = []
    if not file_list:
        return items
    sorted_files = sorted(file_list, key=lambda f: f.name)
    for uf in sorted_files:
        fname = uf.name
        fname_lower = fname.lower()
        fbytes = uf.getvalue()
        if fname_lower.endswith(".pdf"):
            try:
                # Count PDF pages with PyMuPDF without decoding full bitmaps
                try:
                    import pymupdf
                    doc = pymupdf.open(stream=fbytes, filetype="pdf")
                    num_pages = len(doc)
                except Exception:
                    num_pages = 1
                for p_idx in range(num_pages):
                    lbl = f"{fname} (p.{p_idx + 1})" if num_pages > 1 else fname
                    items.append((lbl, fbytes, "pdf", p_idx))
            except Exception as e:
                st.warning(f"Could not read {fname}: {e}")
        elif fname_lower.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(fbytes)) as z:
                    for zname in sorted(z.namelist()):
                        if not zname.startswith("__MACOSX") and zname.lower().endswith((".png", ".jpg", ".jpeg", ".pdf")):
                            data = z.read(zname)
                            if zname.lower().endswith(".pdf"):
                                try:
                                    import pymupdf
                                    doc = pymupdf.open(stream=data, filetype="pdf")
                                    num_pages = len(doc)
                                except Exception:
                                    num_pages = 1
                                for p_idx in range(num_pages):
                                    lbl = f"{zname} (p.{p_idx + 1})" if num_pages > 1 else zname
                                    items.append((lbl, data, "pdf", p_idx))
                            else:
                                items.append((zname, data, "image"))
            except Exception as e:
                st.warning(f"Could not extract ZIP {fname}: {e}")
        elif fname_lower.endswith((".png", ".jpg", ".jpeg")):
            try:
                items.append((fname, fbytes, "image"))
            except Exception as e:
                st.warning(f"Could not read {fname}: {e}")
    return items


# ==============================================================================
# TAB 1: VISUAL DRAG & SCALE OVERLAY
# ==============================================================================
with tab_single:
    st.subheader("Upload Template & QR Code(s)")
    col_u1, col_u2 = st.columns(2)

    with col_u1:
        uploaded_template = st.file_uploader(
            "1. Template (Image or PDF)",
            type=["png", "jpg", "jpeg", "pdf"],
            key="single_template",
            help="Upload your base template (badge, card, ticket) as PNG, JPG, or PDF.",
        )

    with col_u2:
        uploaded_qrs = st.file_uploader(
            "2. QR Codes (Upload 1, multiple, or ALL your PDFs / Images)",
            type=["png", "jpg", "jpeg", "pdf", "zip"],
            accept_multiple_files=True,
            key="main_qr_uploader",
            help="You can select 1 PDF, or highlight 500+ PDFs all at once!",
        )

    # Demo quick-loader
    with st.expander("💡 Need sample assets to test right now?"):
        if st.button("Load Sample Badge & Sample QR"):
            sample_t_path = "sample_assets/sample_badge_template.png"
            if os.path.exists(sample_t_path):
                st.session_state["cal_template_img"] = Image.open(sample_t_path)
                st.session_state["cal_qr_img"] = pdf_generator.generate_qr_image("https://example.com/demo-ticket-001")
                st.success("Sample assets loaded! Try dragging and scaling below.")

    # Determine template
    template_img = None
    if uploaded_template is not None:
        try:
            template_img = load_as_image(uploaded_template, page_num=0, dpi=selected_dpi)
            st.session_state["active_template_img"] = template_img
        except Exception as e:
            st.error(f"Error reading template: {e}")
    elif "cal_template_img" in st.session_state:
        template_img = st.session_state["cal_template_img"]
        st.session_state["active_template_img"] = template_img

    # Determine QR(s)
    qr_img = None
    if uploaded_qrs:
        with st.spinner(f"Processing {len(uploaded_qrs)} QR file(s)..."):
            parsed_qrs = parse_uploaded_qr_files(uploaded_qrs, dpi=selected_dpi)
            if parsed_qrs:
                st.session_state["parsed_qr_items"] = parsed_qrs
                qr_img = get_qr_image_from_item(parsed_qrs[0], dpi=selected_dpi)  # First QR image used for visual placement
                if len(parsed_qrs) > 1:
                    st.success(
                        f"✅ Successfully loaded **{len(parsed_qrs)} total QR codes** from {len(uploaded_qrs)} file(s)! Using `{parsed_qrs[0][0]}` for placement below."
                    )
                else:
                    st.success(f"✅ Loaded QR code: `{parsed_qrs[0][0]}`.")
    elif "cal_qr_img" in st.session_state:
        qr_img = st.session_state["cal_qr_img"]
    elif template_img is not None:
        qr_img = pdf_generator.generate_qr_image("https://example.com/sample-qr")

    st.divider()

    if template_img is None:
        st.info("👆 Please upload your template (Image or PDF) above to start.")
    else:
        t_w, t_h = template_img.size
        st.write(f"📐 **Template Resolution:** `{t_w} × {t_h} px` (Loaded at `{selected_dpi} DPI`)")

        col_canvas, col_result = st.columns(2)

        with col_canvas:
            st.subheader("Interactive Canvas")
            st.markdown("👉 **Drag the blue box** to move. **Drag handles** to scale width and height.")

            lock_square = st.checkbox("Lock 1:1 Square Ratio", value=False, help="Uncheck to adjust width and height freely.")
            aspect_ratio = (1, 1) if lock_square else None

            box_coords = st_cropper(
                img_file=template_img.convert("RGB"),
                realtime_update=True,
                box_color="#38BDF8",
                aspect_ratio=aspect_ratio,
                return_type="box",
                should_resize_image=True,
                stroke_width=3,
                key="interactive_cropper",
            )

            c_left = int(box_coords.get("left", 0))
            c_top = int(box_coords.get("top", 0))
            c_w = int(box_coords.get("width", 300))
            c_h = int(box_coords.get("height", 300))

            st.markdown("#### 📏 Fine-Tune Dimensions & Height")
            col_adj_w, col_adj_h = st.columns(2)
            with col_adj_w:
                qr_w = st.number_input("Width (px)", min_value=10, max_value=t_w, value=c_w, step=5)
            with col_adj_h:
                qr_h = st.number_input("Height (px)", min_value=10, max_value=t_h, value=c_h, step=5)

            qh1, qh2, qh3 = st.columns(3)
            with qh1:
                if st.button("🔼 +10px Height"):
                    qr_h = min(t_h, qr_h + 10)
            with qh2:
                if st.button("🔽 -10px Height"):
                    qr_h = max(10, qr_h - 10)
            with qh3:
                if st.button("🔄 Match Width"):
                    qr_h = qr_w

            pos_x = c_left
            pos_y = c_top

            st.session_state["cal_pos_x"] = pos_x
            st.session_state["cal_pos_y"] = pos_y
            st.session_state["cal_w"] = qr_w
            st.session_state["cal_h"] = qr_h

            st.info(
                f"📌 **Current Placement:**\n"
                f"- **X:** `{pos_x} px` | **Y:** `{pos_y} px`\n"
                f"- **Width:** `{qr_w} px` | **Height:** `{qr_h} px`"
            )

        with col_result:
            st.subheader("Live Composite Output")
            st.caption("Individual card preview (Lossless rendering):")

            combo_img = pdf_generator.composite_qr_on_template(
                template=template_img,
                qr_img=qr_img,
                x=pos_x,
                y=pos_y,
                qr_size=(qr_w, qr_h),
                sharpen_qr=enable_sharpening,
            )
            st.image(combo_img, caption=f"Single Card Preview ({t_w} × {t_h} px)", use_container_width=True)

            d1, d2 = st.columns(2)
            with d1:
                img_buf = io.BytesIO()
                combo_img.convert("RGB").save(img_buf, format="PNG")
                st.download_button(
                    "💾 Download Lossless Image (PNG)",
                    data=img_buf.getvalue(),
                    file_name="combo_sample.png",
                    mime="image/png",
                    use_container_width=True,
                )
                pdf_buf = io.BytesIO()
                pdf_generator.create_single_item_pdf(
                    [combo_img],
                    pdf_buf,
                    dpi=selected_dpi,
                    compression=pdf_comp_type,
                    quality=pdf_quality,
                )
                st.download_button(
                    "📄 Download Lossless PDF (1 Card)",
                    data=pdf_buf.getvalue(),
                    file_name="combo_sample.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                )

        # Expandable preview of 1 full sheet
        with st.expander(f"👁️ Click to preview 1 full sheet page ({grid_cols} cols × {grid_rows} rows = {items_per_page} items)"):
            if st.button(f"Render {items_per_page}-item Sheet Preview"):
                with st.spinner(f"Arranging {items_per_page} items in {grid_cols} columns × {grid_rows} rows with LANCZOS filter..."):
                    preview_sheets = pdf_generator.generate_grid_sheets_direct(
                        template=template_img,
                        qr_items=[qr_img] * items_per_page,
                        calibrated_x=pos_x,
                        calibrated_y=pos_y,
                        calibrated_w=qr_w,
                        calibrated_h=qr_h,
                        page_size=page_paper,
                        rows=grid_rows,
                        cols=grid_cols,
                        margin_px=margin_px,
                        spacing_px=spacing_px,
                        dpi=selected_dpi,
                        draw_cut_lines=draw_guides,
                        sharpen_cards=enable_sharpening,
                        fill_cells=fill_cells,
                        underlay_mask="none",
                    )
                    if preview_sheets:
                        st.image(
                            preview_sheets[0],
                            caption=f"Full Sheet Preview ({selected_dpi} DPI): Exactly {items_per_page} cards in {grid_cols} Cols × {grid_rows} Rows",
                            use_container_width=True,
                        )


# ==============================================================================
# TAB 2: BATCH GRID PDF GENERATION
# ==============================================================================
with tab_batch:
    st.subheader(f"Batch Process QRs into Printable Sheets ({grid_cols} Cols × {grid_rows} Rows = {items_per_page} / Page)")

    active_template = st.session_state.get("active_template_img", template_img)
    calibrated_x = st.session_state.get("cal_pos_x", 0)
    calibrated_y = st.session_state.get("cal_pos_y", 0)
    calibrated_w = st.session_state.get("cal_w", 300)
    calibrated_h = st.session_state.get("cal_h", 300)

    st.markdown(
        f"Using Calibrated Coordinates: **X={calibrated_x}px, Y={calibrated_y}px, Size={calibrated_w}×{calibrated_h}px**"
    )

    st.info(f"📐 **Current Grid Layout:** `{grid_cols} columns × {grid_rows} rows` = **{items_per_page} items per page** on `{page_paper}` paper at `{selected_dpi} DPI`. *(You can change rows, columns, margins, and paper size in the left sidebar anytime!)*")

    # Check if files already uploaded in Tab 1
    shared_items = st.session_state.get("parsed_qr_items", [])
    
    st.write("### Choose QR Input Source:")
    options = ["Use Files Already Uploaded in Step 1", "Upload More PDF Files / Images / ZIP", "Local Folder Path (Instant for 500+ files)", "CSV / Excel File (Auto-generate QRs)"]
    if not shared_items:
        options.pop(0)

    input_method = st.radio("Select Batch QR Source:", options, index=0)

    batch_qr_items = []

    if input_method == "Use Files Already Uploaded in Step 1":
        batch_qr_items = shared_items
        st.success(f"✅ Using **{len(batch_qr_items)} QR items** loaded from Step 1.")

    elif input_method == "Upload More PDF Files / Images / ZIP" or input_method == "Upload Multiple PDF Files (or Images / ZIP)":
        uploaded_multi = st.file_uploader(
            "Upload multiple PDF files, Images, or a ZIP archive",
            type=["pdf", "png", "jpg", "jpeg", "zip"],
            accept_multiple_files=True,
            key="batch_multi_files",
            help="Select hundreds of PDF files at once, or multi-page PDFs.",
        )
        if uploaded_multi:
            with st.spinner(f"Reading {len(uploaded_multi)} uploaded file(s) at {selected_dpi} DPI..."):
                batch_qr_items = parse_uploaded_qr_files(uploaded_multi, dpi=selected_dpi)
                st.success(f"✅ Loaded **{len(batch_qr_items)} total QR items** from {len(uploaded_multi)} file(s).")

    elif "Local Folder Path" in input_method:
        st.markdown("💡 **Tip:** If your PDFs are already in a folder on your Mac/PC, paste the folder path below for instant loading!")
        folder_path = st.text_input("Enter folder path (e.g. /Users/name/Desktop/qrs or C:\\qrs):", value="")
        if folder_path:
            if os.path.isdir(folder_path):
                patterns = ["*.pdf", "*.png", "*.jpg", "*.jpeg", "*.PDF", "*.PNG", "*.JPG", "*.JPEG"]
                found_files = []
                for pat in patterns:
                    found_files.extend(glob.glob(os.path.join(folder_path, pat)))
                found_files = sorted(found_files)
                if found_files:
                    st.success(f"Found **{len(found_files)}** files in `{folder_path}`.")
                    batch_qr_items = found_files
                else:
                    st.warning("No PDF or image files found in that folder.")
            else:
                st.error("Folder path not found on computer.")

    else:
        uploaded_csv = st.file_uploader("Upload CSV or Excel file", type=["csv", "xlsx", "xls"], key="batch_csv")
        if uploaded_csv:
            try:
                df = pd.read_csv(uploaded_csv) if uploaded_csv.name.endswith(".csv") else pd.read_excel(uploaded_csv)
                target_col = st.selectbox("Select column with QR data", df.columns)
                records = df[target_col].dropna().astype(str).tolist()
                st.success(f"Loaded **{len(records)}** records.")
                batch_qr_items = records
            except Exception as e:
                st.error(f"Error loading file: {e}")

    # Generate Button
    if active_template is None:
        st.warning("Please upload a template in Tab 1 first.")
    elif not batch_qr_items:
        st.info("Provide your QR items above to begin batch PDF creation.")
    else:
        total_items = len(batch_qr_items)
        import math
        total_sheet_pages = math.ceil(total_items / items_per_page)

        b1, b2, b3 = st.columns(3)
        b1.metric("Total QR Items", f"{total_items}")
        b2.metric("Grid Layout", f"{grid_cols} cols × {grid_rows} rows")
        b3.metric("Total Sheet Pages", f"{total_sheet_pages} page{'s' if total_sheet_pages > 1 else ''} ({items_per_page}/page)")

        if st.button("🚀 Generate Lossless Print-Ready PDF", type="primary", use_container_width=True):
            pbar = st.progress(0.0)
            status = st.empty()

            status.text(f"Building lossless {selected_dpi} DPI PDF sheets ({total_sheet_pages} pages) with zero memory overhead...")

            def on_progress(current, total):
                pbar.progress(min(0.95, current / total))

            master_pdf_buf = io.BytesIO()
            sheet_pages = pdf_generator.create_grid_sheet_pdf_direct(
                template=active_template,
                qr_items=batch_qr_items,
                output_stream_or_path=master_pdf_buf,
                calibrated_x=calibrated_x,
                calibrated_y=calibrated_y,
                calibrated_w=calibrated_w,
                calibrated_h=calibrated_h,
                page_size=page_paper,
                rows=grid_rows,
                cols=grid_cols,
                margin_px=margin_px,
                spacing_px=spacing_px,
                dpi=selected_dpi,
                draw_cut_lines=draw_guides,
                sharpen_cards=enable_sharpening,
                fill_cells=fill_cells,
                underlay_mask="none",
                progress_callback=on_progress,
                compression=pdf_comp_type,
                quality=pdf_quality,
            )
            pbar.progress(1.0)
            master_pdf_bytes = master_pdf_buf.getvalue()
            pdf_size_mb = len(master_pdf_bytes) / (1024 * 1024)
            status.success(f"🎉 Complete! Generated {len(sheet_pages)} page(s) at {selected_dpi} DPI ({total_items} items total) — **File Size: {pdf_size_mb:.2f} MB**.")

            col_d_all, col_d_zip = st.columns(2)

            with col_d_all:
                st.download_button(
                    label=f"📄 Download Print-Ready PDF ({len(sheet_pages)} page{'s' if len(sheet_pages) > 1 else ''}, {pdf_size_mb:.1f} MB)",
                    data=master_pdf_bytes,
                    file_name=f"printable_grid_{total_items}_items_{grid_cols}x{grid_rows}_{pdf_size_mb:.0f}mb.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                )

            with col_d_zip:
                zip_sheets_buf = io.BytesIO()
                with zipfile.ZipFile(zip_sheets_buf, "w", zipfile.ZIP_DEFLATED) as szip:
                    pt_dims = pdf_generator.PAPER_POINTS.get(page_paper, (595.28, 841.89))
                    for s_idx, s_img in enumerate(sheet_pages):
                        s_pdf_buf = io.BytesIO()
                        pdf_generator.save_images_to_pdf_lossless(
                            [s_img],
                            s_pdf_buf,
                            dpi=selected_dpi,
                            page_pt_dims=pt_dims,
                            compression=pdf_comp_type,
                            quality=pdf_quality,
                        )
                        szip.writestr(f"sheet_{s_idx + 1:02d}_{items_per_page}_items.pdf", s_pdf_buf.getvalue())

                zip_sheets_buf.seek(0)
                zip_bytes = zip_sheets_buf.getvalue()
                zip_size_mb = len(zip_bytes) / (1024 * 1024)
                st.download_button(
                    label=f"📦 Download Individual Sheet PDFs (ZIP, {zip_size_mb:.1f} MB)",
                    data=zip_bytes,
                    file_name=f"individual_sheets_{len(sheet_pages)}_pages.zip",
                    mime="application/zip",
                    use_container_width=True,
                )
