"""
Actian VectorAI DB Seed Script
Creates the required tables and seeds with demo data.

Run: python -m data.seed_actian

Requires:
  - Actian VectorAI DB running (docker pull williamimoh/actian-vectorai-db:1.0b)
  - sentence-transformers installed
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import config

VERIFIED_CLAIMS = [
    ("Acme Corp revenue grew 7.6% QoQ in Q3 2024", True, "finance"),
    ("Acme Corp Q3 2024 revenue was $1.84 billion", True, "finance"),
    ("Acme Corp operating margin was approximately 30.8% in Q3 2024", True, "finance"),
    ("NVIDIA Q4 FY2024 revenue was $22.1 billion", True, "finance"),
    ("NVIDIA data center revenue grew 409% year-over-year in Q4 FY2024", True, "finance"),
    ("NVIDIA gaming revenue was $2.9 billion in Q4 FY2024", True, "finance"),
    ("NVIDIA is the largest semiconductor company by market capitalization", True, "finance"),
    ("Memorial Hospital v. Shadur (7th Cir. 1981) is the leading case on peer review privilege", True, "legal"),
    ("The HCQIA provides qualified immunity, not absolute privilege", True, "legal"),
    ("Agster v. Maricopa County (9th Cir.) carved exceptions to peer review privilege", True, "legal"),
]

HALLUCINATION_ARCHIVE = [
    ("Acme Corp revenue grew 32% QoQ", "inflated_growth", "finance"),
    ("Acme Corp revenue grew 28% quarter-over-quarter", "inflated_growth", "finance"),
    ("Acme Corp announced a $2 billion stock buyback program", "fabricated_event", "finance"),
    ("Harrison v. Mercy General Hospital (2019)", "phantom_citation", "legal"),
    ("Thompson v. Regional Medical Center (2021)", "phantom_citation", "legal"),
    ("Smith v. County Hospital (2020)", "phantom_citation", "legal"),
    ("Williams v. State Medical Board (2018)", "phantom_citation", "legal"),
]

ANALYST_REPORTS = [
    ("Analyst consensus for Acme Corp Q3 2024 growth: 6-9% QoQ", "finance"),
    ("14 sell-side analysts modeled Acme Corp growth below 15%", "finance"),
    ("No analyst forecast Acme Corp growth above 12% for Q3", "finance"),
    ("NVIDIA Q4 FY2024 beat consensus estimate of $20.4B by 8.3%", "finance"),
    ("Multiple analyst reports confirm NVIDIA $22.1B Q4 revenue", "finance"),
    ("Peer review privilege varies significantly across federal circuits", "legal"),
    ("Third Circuit applies narrower peer review privilege test", "legal"),
]


def seed():
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. Run: pip install psycopg2-binary")
        return

    try:
        from sentence_transformers import SentenceTransformer
        encoder = SentenceTransformer(config.EMBEDDING_MODEL)
    except ImportError:
        print("sentence-transformers not installed. Run: pip install sentence-transformers")
        return

    print(f"Connecting to Actian VectorAI at {config.ACTIAN_VECTORAI_HOST}:{config.ACTIAN_VECTORAI_PORT}...")

    try:
        conn = psycopg2.connect(
            host=config.ACTIAN_VECTORAI_HOST,
            port=config.ACTIAN_VECTORAI_PORT,
            dbname=config.ACTIAN_VECTORAI_DB,
            user=config.ACTIAN_VECTORAI_USER,
            password=config.ACTIAN_VECTORAI_PASSWORD,
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure Actian VectorAI DB is running:")
        print("  docker pull williamimoh/actian-vectorai-db:1.0b")
        print("  docker run -d -p 5432:5432 williamimoh/actian-vectorai-db:1.0b")
        return

    # Create tables
    print("Creating tables...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verified_claims (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            verdict BOOLEAN NOT NULL,
            domain VARCHAR(50),
            embedding vector(384),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hallucination_archive (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            pattern VARCHAR(100),
            domain VARCHAR(50),
            embedding vector(384),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyst_reports (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            domain VARCHAR(50),
            embedding vector(384),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()

    # Seed verified claims
    print("Seeding verified claims...")
    for text, verdict, domain in VERIFIED_CLAIMS:
        emb = encoder.encode(text).tolist()
        cursor.execute(
            "INSERT INTO verified_claims (text, verdict, domain, embedding) VALUES (%s, %s, %s, %s::vector)",
            (text, verdict, domain, str(emb)),
        )

    # Seed hallucination archive
    print("Seeding hallucination archive...")
    for text, pattern, domain in HALLUCINATION_ARCHIVE:
        emb = encoder.encode(text).tolist()
        cursor.execute(
            "INSERT INTO hallucination_archive (text, pattern, domain, embedding) VALUES (%s, %s, %s, %s::vector)",
            (text, pattern, domain, str(emb)),
        )

    # Seed analyst reports
    print("Seeding analyst reports...")
    for text, domain in ANALYST_REPORTS:
        emb = encoder.encode(text).tolist()
        cursor.execute(
            "INSERT INTO analyst_reports (text, domain, embedding) VALUES (%s, %s, %s::vector)",
            (text, domain, str(emb)),
        )

    conn.commit()
    cursor.close()
    conn.close()
    print("Done! Actian VectorAI DB seeded successfully.")


if __name__ == "__main__":
    seed()
