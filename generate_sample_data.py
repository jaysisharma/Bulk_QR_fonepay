"""
Utility to generate sample template image and sample CSV of 528 QR records.
"""

import os
import csv
from PIL import Image, ImageDraw, ImageFont


def create_sample_assets(output_dir="sample_assets"):
    os.makedirs(output_dir, exist_ok=True)

    # 1. Create a stylish badge/card template (1000 x 1500 px)
    width, height = 1000, 1500
    img = Image.new("RGB", (width, height), color="#0F172A")
    draw = ImageDraw.Draw(img)

    # Draw decorative header banner
    draw.rectangle([0, 0, width, 240], fill="#2563EB")
    draw.rectangle([0, 240, width, 250], fill="#38BDF8")

    # Card border
    draw.rounded_rectangle([20, 20, width - 20, height - 20], radius=30, outline="#334155", width=4)

    # Header text fallback (using default font if custom font not found)
    draw.text((width // 2 - 150, 100), "VIP ACCESS PASS", fill="white")
    draw.text((width // 2 - 170, 400), "CONFERENCE 2026", fill="#E2E8F0")

    # QR placeholder box (for visual guidance)
    box_size = 350
    box_x = (width - box_size) // 2
    box_y = 850
    draw.rounded_rectangle(
        [box_x - 10, box_y - 10, box_x + box_size + 10, box_y + box_size + 10],
        radius=16,
        fill="#1E293B",
        outline="#38BDF8",
        width=2,
    )
    draw.text((box_x + 50, box_y + box_size // 2 - 10), "PLACE QR CODE HERE", fill="#94A3B8")

    # Footer
    draw.text((width // 2 - 120, height - 100), "SCAN TO VERIFY", fill="#64748B")

    template_path = os.path.join(output_dir, "sample_badge_template.png")
    img.save(template_path)
    print(f"Created sample template: {template_path}")

    # 2. Create CSV with 528 items (exactly 4 batches of 132 items)
    csv_path = os.path.join(output_dir, "sample_qr_data_528.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "name", "ticket_url", "security_hash"])
        for i in range(1, 529):
            writer.writerow([
                f"TICKET-{i:04d}",
                f"Guest #{i:03d}",
                f"https://event.example.com/checkin/TICKET-{i:04d}?auth=KEY_{i*9973}",
                f"HASH_{i*31337}",
            ])
    print(f"Created sample CSV: {csv_path} (528 records)")


if __name__ == "__main__":
    create_sample_assets()
