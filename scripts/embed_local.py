#!/usr/bin/env python3
import sys
import json
from sentence_transformers import SentenceTransformer

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    text = data.get('text') or data.get('input') or ''
    if not text:
        print(json.dumps({"error":"no input text provided"}))
        return
    model = SentenceTransformer("all-MiniLM-L6-v2")
    if isinstance(text, list):
        embs = model.encode(text)
        out = [e.tolist() for e in embs]
        print(json.dumps({"embeddings": out}))
    else:
        emb = model.encode([text])[0]
        print(json.dumps({"embedding": emb.tolist()}))

if __name__ == '__main__':
    main()
