#!/usr/bin/env python3
"""
Folder Splitter Utility
=======================
Splits large directories containing 500, 600, 1000+ files into batches of up to 132 files
per folder (A, B, C, D, etc.), matching the 132-QR bulk sheet specifications.

Usage:
  python split_folder.py
  python split_folder.py --source /path/to/folder --batch-size 132 --mode copy
"""

import os
import sys
import shutil
import re
import argparse
from pathlib import Path


def natural_sort_key(s: str):
    """Sort strings containing numbers in human-expected numerical order."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


def get_letter_label(idx: int) -> str:
    """Generate Excel-style column labels: 0 -> A, 1 -> B, 25 -> Z, 26 -> AA, etc."""
    result = []
    while True:
        rem = idx % 26
        result.append(chr(ord('A') + rem))
        if idx < 26:
            break
        idx = (idx // 26) - 1
    return "".join(reversed(result))


def split_directory(
    source_dir: str,
    dest_dir: str = None,
    batch_size: int = 132,
    mode: str = "move",
    naming_style: str = "batch_letter",
    extensions: list = None
):
    source_path = Path(source_dir).expanduser().resolve()
    if not source_path.is_dir():
        print(f"❌ Error: Source directory does not exist: {source_path}")
        return False

    # Gather regular files, ignoring hidden files
    all_files = []
    ext_counts = {}
    for entry in source_path.iterdir():
        if entry.is_file() and not entry.name.startswith('.') and entry.name != "Thumbs.db":
            ext = entry.suffix.lower()
            if extensions:
                norm_exts = [e if e.startswith('.') else f".{e}" for e in extensions]
                if ext not in norm_exts:
                    continue
            ext_counts[ext] = ext_counts.get(ext, 0) + 1
            all_files.append(entry)

    if not all_files:
        print(f"⚠️ No matching files found in: {source_path}")
        return False

    # Sort files naturally
    all_files.sort(key=lambda p: natural_sort_key(p.name))
    total_files = len(all_files)

    # Determine output root
    if dest_dir:
        dest_root = Path(dest_dir).expanduser().resolve()
    else:
        dest_root = source_path / f"Batches_{batch_size}"

    dest_root.mkdir(parents=True, exist_ok=True)

    # Chunk into groups of batch_size
    chunks = [all_files[i:i + batch_size] for i in range(0, total_files, batch_size)]
    total_folders = len(chunks)

    print("\n" + "=" * 60)
    print(f"📁 FOLDER SPLITTER (Max {batch_size} files per folder)")
    print("=" * 60)
    print(f"📂 Source:      {source_path}")
    print(f"🎯 Destination: {dest_root}")
    print(f"📊 Total Files: {total_files}")
    print(f"📦 Batch Size:  {batch_size} files/folder")
    print(f"📁 Folders:     {total_folders} ({'Copying' if mode == 'copy' else 'Moving'})")
    print("-" * 60)

    for idx, chunk in enumerate(chunks):
        letter = get_letter_label(idx)
        start_num = idx * batch_size + 1
        end_num = start_num + len(chunk) - 1

        if naming_style == "letter_only":
            folder_name = letter
        elif naming_style == "batch_letter_range":
            folder_name = f"Folder_{letter} ({start_num}-{end_num})"
        elif naming_style == "numbered":
            pad = 3 if total_folders >= 100 else 2
            folder_name = f"Batch_{idx + 1:0{pad}d}"
        else: # "batch_letter" default
            folder_name = f"Batch_{letter}"

        target_folder = dest_root / folder_name
        target_folder.mkdir(parents=True, exist_ok=True)

        for file_path in chunk:
            target_file = target_folder / file_path.name
            if mode == "move":
                shutil.move(str(file_path), str(target_file))
            else:
                shutil.copy2(str(file_path), str(target_file))

        print(f"  ✓ {folder_name:<28} : {len(chunk):>3} files  (Files #{start_num} - #{end_num})")

    print("-" * 60)
    print(f"✨ Successfully organized {total_files} files into {total_folders} folders!")
    print(f"📂 Location: {dest_root}\n")
    return True


def interactive_mode():
    print("\n" + "=" * 55)
    print("      QR Studio - Bulk 132 Folder Splitter")
    print("=" * 55)
    source = input("\n👉 Enter the path to the folder with files: ").strip().strip("'\"")
    if not source:
        print("Aborted.")
        return

    batch_input = input("👉 Batch size (default 132 per folder): ").strip()
    batch_size = int(batch_input) if batch_input.isdigit() and int(batch_input) > 0 else 132

    print("\nChoose folder naming style:")
    print("  1) Batch_A, Batch_B, Batch_C... (Default)")
    print("  2) A, B, C, D...")
    print("  3) Folder_A (1-132), Folder_B (133-264)...")
    print("  4) Batch_01, Batch_02...")
    naming_choice = input("Choice [1-4, default 1]: ").strip()
    naming_map = {
        "1": "batch_letter",
        "2": "letter_only",
        "3": "batch_letter_range",
        "4": "numbered"
    }
    naming_style = naming_map.get(naming_choice, "batch_letter")

    print("\nOperation:")
    print("  1) Move files (Auto-clean source folder into batches) [Default]")
    print("  2) Copy files (Leaves duplicates in source folder)")
    mode_choice = input("Choice [1/2, default 1]: ").strip()
    mode = "copy" if mode_choice == "2" else "move"

    dest_input = input("\nDestination folder (press Enter to create 'Batches_132' inside source): ").strip().strip("'\"")
    dest_dir = dest_input if dest_input else None

    split_directory(
        source_dir=source,
        dest_dir=dest_dir,
        batch_size=batch_size,
        mode=mode,
        naming_style=naming_style
    )


def main():
    parser = argparse.ArgumentParser(
        description="Split a folder containing hundreds of files into batches of 132 (or N) files per folder."
    )
    parser.add_argument("--source", "-s", type=str, help="Source directory containing files")
    parser.add_argument("--dest", "-d", type=str, default=None, help="Destination directory (default: <source>/Batches_<size>)")
    parser.add_argument("--batch-size", "-b", type=int, default=132, help="Max files per folder (default: 132)")
    parser.add_argument(
        "--mode", "-m", choices=["copy", "move"], default="move", help="File operation: 'move' or 'copy' (default: move)"
    )
    parser.add_argument(
        "--naming",
        "-n",
        choices=["batch_letter", "letter_only", "batch_letter_range", "numbered"],
        default="batch_letter",
        help="Folder naming scheme (default: batch_letter)"
    )
    parser.add_argument(
        "--ext",
        "-e",
        nargs="+",
        default=None,
        help="Filter specific extensions e.g. -e png jpg pdf"
    )

    args = parser.parse_args()

    if not args.source:
        interactive_mode()
    else:
        split_directory(
            source_dir=args.source,
            dest_dir=args.dest,
            batch_size=args.batch_size,
            mode=args.mode,
            naming_style=args.naming,
            extensions=args.ext
        )


if __name__ == "__main__":
    main()
