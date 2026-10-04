# 🎫 Batch QR & Template PDF Generator

A high-performance, cross-platform tool to composite hundreds of QR codes onto custom template images (badges, cards, wristbands, stickers, tickets) and export them into print-ready PDFs in batches of **132 items**.

Runs natively on **macOS** and **Windows**.

---

## 🚀 Quick Start

### On macOS / Linux:
Simply run the launcher script from your terminal:
```bash
./run.sh
```
*(This automatically creates `.venv`, installs dependencies, and opens the app in your default browser).*

### On Windows:
Double-click:
```cmd
run.bat
```
*(Or execute `run.bat` inside Command Prompt / PowerShell).*

---

## 🎯 How It Works

1. **Step 1: Upload Template & Data**
   * **Template Image**: Upload any badge, ticket, card, or label graphic (`.png`, `.jpg`).
   * **QR Data**:
     * **CSV or Excel file**: Select any column containing your links, IDs, or text. The app generates sharp vector-style QR codes automatically.
     * **Or Pre-generated QR Images**: Upload a `.zip` containing your `.png` QR codes.
   * *(Need to test right away? Use the built-in "Generate Sample Demo Template & CSV Data" button!)*

2. **Step 2: Live Calibration**
   * Drag the sliders for **X Position**, **Y Position**, and **QR Size**.
   * Use quick alignment presets (**Center**, **Bottom Center**).
   * See a real-time live preview of the QR placed on your template before processing 500+ items.

3. **Step 3: Batch Generation & Download**
   * Default batch size: **132 items per PDF** (customizable).
   * **Layout Modes**:
     * **1 Card per Page**: Each PDF contains 132 individual card pages.
     * **Grid Sheet**: Arranges cards across rows and columns on printable sheets (A4 / US Letter) for sticker or label printing.
   * Click **🚀 Start Batch Generation**.
   * Download the complete set of generated PDFs packaged in a single `.zip` file!

---

## 🛠️ Tech Stack & Requirements
* **Python 3.10+**
* **Streamlit**: Interactive browser-based UI.
* **Pillow (PIL)**: High-resolution image compositing.
* **qrcode**: Clean QR generation with configurable error correction (L, M, Q, H).
* **ReportLab / Pillow PDF**: Exact DPI preservation (300 DPI for sharp physical scanning).
* **Pandas & OpenPyXL**: Fast CSV and Excel data parsing.
# Bulk_QR_fonepay
