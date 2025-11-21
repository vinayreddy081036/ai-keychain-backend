import os
import cv2
import subprocess
import numpy as np

def process_image(input_path, output_dir, file_id):
    """
    Converts an image to a clean SVG silhouette.
    1. Read image
    2. Threshold to B&W
    3. Save as PBM
    4. Run potrace -> SVG
    """
    # Read image
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError("Could not read image")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Threshold (Otsu's binarization)
    # Invert if needed? Usually we want the object to be black on white for potrace?
    # Potrace traces black shapes.
    # Let's assume the object is darker than background or use simple thresholding.
    # We'll use Otsu.
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Clean up noise (optional morphological operations)
    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

    # Save as PBM (Portable Bitmap)
    pbm_path = os.path.join(output_dir, f"{file_id}.pbm")
    # cv2 doesn't support PBM directly well in all versions, but we can save as PBM using imwrite with .pbm extension
    # PBM format: P1 (ascii) or P4 (binary). OpenCV usually handles it.
    cv2.imwrite(pbm_path, thresh)

    # Run potrace
    svg_path = os.path.join(output_dir, f"{file_id}.svg")
    # -s for SVG, --flat for single path (optional)
    cmd = ["potrace", pbm_path, "-s", "-o", svg_path]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Potrace failed: {result.stderr}")

    return svg_path
