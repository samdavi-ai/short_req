import sqlite3

def table_to_markdown(db_file, table_name, limit=20):
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]
    
    if not columns:
        return f"Table `{table_name}` not found or empty."
        
    cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
    rows = cursor.fetchall()
    conn.close()
    
    md = f"### Table: `{table_name}`\n\n"
    md += "| " + " | ".join(columns) + " |\n"
    md += "|-" + "-|-".join(["-" * len(c) for c in columns]) + "-|\n"
    for row in rows:
        md += "| " + " | ".join([str(v)[:50] for v in row]) + " |\n"
    
    if len(rows) == limit:
        md += f"\n*Showing top {limit} rows...*\n"
    elif len(rows) == 0:
        md += "\n*No records in table.*\n"
    return md + "\n---\n"

with open('db_view.md', 'w') as f:
    f.write("# Database Explorer View\n\n")
    f.write("## Main Database (`db.sqlite3`)\n\n")
    for t in ['cameras', 'zones', 'users', 'layouts']:
        f.write(table_to_markdown('db.sqlite3', t))

    f.write("## AI Cache Database (`database.db`)\n\n")
    for t in ['enrolled_identities', 'detections']:
        f.write(table_to_markdown('database.db', t, limit=5))

