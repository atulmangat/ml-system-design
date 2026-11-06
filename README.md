# Machine Learning System Design Interview Study Guide

A comprehensive, diagram-rich self-study guide for Machine Learning System Design interviews. Covers 11 chapters with 227+ custom SVG diagrams, end-to-end architectures, worked latency/storage arithmetic, and deep operational trade-offs cross-referenced with top industry papers (NeurIPS, ICML, KDD, Meta, Google, LinkedIn, Airbnb, Pinterest).

---

## 📚 Chapters

| # | Chapter | Key Topics & Architecture Highlights | Diagrams |
|---|---|---|---|
| **01** | [**Introduction & 7-Step Blueprint**](mlsd/intro.html) | Universal ML interview framework, latency budgeting, candidate-retrieval-ranking-re-ranking funnel rubric, radar readiness scorecard | 9 |
| **02** | [**Visual Search System**](mlsd/visual-search.html) | Two-stage image retrieval, ResNet/ViT feature extraction, HNSW indexing, multi-task ranking | 25 |
| **03** | [**Google Street View Blurring**](mlsd/street-view-blurring.html) | Privacy detection pipeline, face & license plate segmentation, tiling & seam blending, human-in-the-loop audit | 24 |
| **04** | [**YouTube Video Search**](mlsd/youtube-video-search.html) | Multi-modal video understanding (frames, audio transcripts, metadata), dual-encoder two-tower retrieval, fresh video ingestion | 21 |
| **05** | [**Harmful Content Detection**](mlsd/harmful-content-detection.html) | Policy violation classifiers, streaming inference pipeline, active learning loops, adversarial evasion handling | 22 |
| **06** | [**Video Recommendation System**](mlsd/video-recommendation.html) | Two-tower neural collaborative filtering, deep ranking network, diversity & exploration re-ranking | 22 |
| **07** | [**Event Recommendation System**](mlsd/event-recommendation.html) | Cold-start handling for ephemeral events, spatial-temporal filtering, multi-objective ranking (RSVP, click, attend) | 22 |
| **08** | [**Ad Click-Through Rate (CTR) Prediction**](mlsd/ad-click-prediction.html) | Deep & Cross Network (DCN-v2), calibration (Platt scaling / isotonic), real-time streaming feature stores, eCPM auction | 22 |
| **09** | [**Similar Listings on Vacation Rentals**](mlsd/similar-listings.html) | Real-time session-based embeddings, listing co-booking graphs, multi-head ranking with seasonality features | 22 |
| **10** | [**Personalized News Feed**](mlsd/news-feed.html) | Graph-based edge ranking, social signal feature stores, position bias debiasing, low-latency scoring | 22 |
| **11** | [**People You May Know**](mlsd/people-you-may-know.html) | Graph Neural Networks (GraphSAGE / Random Walk with Restart), link prediction, mutual friend features, anti-spam heuristics | 21 |

---

## 🛠 Features

- **7-Step Blueprint:** Clarifying requirements, framing as ML task, data engineering, baseline & deep architectures, offline & online evaluation, serving & operational trade-offs.
- **227+ Interactive SVG Diagrams:** System architectures, data pipelines, funnel representations, trade-off matrices, and evaluation curves rendered cleanly with responsive vector graphics.
- **Interactive Check Yourself Drills:** Filter questions by level (Senior, Staff, Principal), timed 2-minute drill mode, and self-evaluation readiness scorecard radar.
- **Self-Contained & Fast:** Zero dependencies or heavy frameworks. Pure static HTML, modern CSS, and lightweight vanilla JavaScript.

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/atulmangat/ml-system-design.git
cd ml-system-design

# Run HTTP server serving the mlsd directory
python3 -m http.server 8765 --directory mlsd

# Open in your browser
open http://localhost:8765/
```

---

## 🌐 Deployment

- **Live URL:** [https://ml-system-design-liard.vercel.app](https://ml-system-design-liard.vercel.app)
- **Host:** Vercel (Root Directory: `mlsd`)
- Continuous deployment enabled on pushes to `main`.

---

## 📖 Attribution

The syllabus and general chapter structure follow *Machine Learning System Design Interview* by Ali Aminian and Alex Xu (ByteByteGo). The prose, worked arithmetic, tables, and SVG diagrams here are original, developed independently for self-study and cross-referenced against public research papers and engineering blogs. For the authors' comprehensive published work, visit the [official ByteByteGo course](https://bytebytego.com/courses/machine-learning-system-design-interview).

---

## 📄 License

MIT
