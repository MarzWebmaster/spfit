#!/usr/bin/env python3
"""
SPFIT PDF OCR Processor
Extracts text from PDF pages - text-based or scanned (via Tesseract OCR)
Outputs one JSON line per page to stdout for streaming consumption.

Usage: python3 ocr_process.py <pdf_path> [dpi]
"""

import json, sys, os, time
import fitz  # PyMuPDF
# Using EasyOCR instead of pytesseract for handwriting support
import json, subprocess
from PIL import Image
import io

# Global EasyOCR reader (lazy init)
_easyocr_reader = None

def extract_page(pdf_path: str, page_num: int, dpi: int = 200) -> dict:
    """Extract text from a single PDF page. Returns dict with page number and text."""
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_num]
        
        # Try 1: Extract text directly (for text-based PDFs)
        text = page.get_text().strip()
        
        if len(text) > 20:
            return {"page": page_num + 1, "text": text, "source": "text"}
        
        # Try 2: OCR the page (for scanned PDFs)
        # Render page to image at specified DPI
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))
        
        # OCR with EasyOCR (handwriting-aware, model loaded once globally)
        global _easyocr_reader
        try:
            if _easyocr_reader is None:
                import easyocr
                _easyocr_reader = easyocr.Reader(['en', 'ms'], gpu=False)
            import numpy as np
            img_array = np.array(img.convert('RGB'))
            easy_result = _easyocr_reader.readtext(img_array, detail=0, paragraph=True)
            ocr_text = '\n'.join(easy_result) if easy_result else ''
        except Exception:
            ocr_text = ''
        
        if ocr_text:
            return {"page": page_num + 1, "text": ocr_text, "source": "ocr"}
        else:
            return {"page": page_num + 1, "text": "", "source": "empty"}
    finally:
        doc.close()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ocr_process.py <pdf_path> [dpi]"}), file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}), file=sys.stderr)
        sys.exit(1)
    
    # Get page count
    try:
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
    except Exception as e:
        print(json.dumps({"error": f"Cannot open PDF: {str(e)}"}), file=sys.stderr)
        sys.exit(1)
    
    # Process each page and output one JSON line per page
    for page_num in range(total_pages):
        result = extract_page(pdf_path, page_num, dpi)
        # Add total pages info
        result["total_pages"] = total_pages
        # Output line
        print(json.dumps(result))
        sys.stdout.flush()

if __name__ == "__main__":
    main()

