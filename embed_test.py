from sentence_transformers import SentenceTransformer
m = SentenceTransformer("all-MiniLM-L6-v2")
v = m.encode(["teste de embedding"])
print("dim =", len(v[0]))
print("amostra =", v[0][:6])