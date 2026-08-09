#!/usr/bin/env python3
"""EasyOCR Wrapper for SPFIT - handles version differences"""
import sys, json, os, easyocr

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 easyocr_process.py <image_path> [lang1,lang2,...]"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    langs = sys.argv[2].split(',') if len(sys.argv) > 2 else ['en', 'ms']
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)
    
    try:
        reader = easyocr.Reader(langs, gpu=False)
        # detail=0 returns just text strings, no bbox/conf
        results = reader.readtext(image_path, detail=0, paragraph=True)
        
        text = "\n".join(results) if results else ""
        output = {"text": text, "blocks": len(results), "confidence": 1.0}
        print(json.dumps(output))
    except Exception as e:
        try:
            reader = easyocr.Reader(langs, gpu=False)
            results = reader.readtext(image_path, detail=1)
            text_parts = []
            for r in results:
                text_parts.append(r[1] if len(r) >= 2 else str(r))
            text = "\n".join(text_parts)
            output = {"text": text, "blocks": len(text_parts), "confidence": 1.0}
            print(json.dumps(output))
        except Exception as e2:
            print(json.dumps({"error": f"EasyOCR failed: {str(e2)[:200]}"}))
            sys.exit(1)
