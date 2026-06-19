import sqlite3
import json

def inspect_db_sqlite3():
    print("=== backend/db.sqlite3 ===")
    conn = sqlite3.connect("backend/db.sqlite3")
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print("Tables:", tables)
    
    for table in tables:
        if table in ["visitors", "employees"]:
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [c[1] for c in cursor.fetchall()]
            print(f"\nTable: {table} (columns: {columns})")
            
            cursor.execute(f"SELECT * FROM {table};")
            rows = cursor.fetchall()
            print(f"Row count: {len(rows)}")
            for r in rows[:5]:
                # Print row details, but truncate large vector output for readability
                r_str = []
                for val in r:
                    val_str = str(val)
                    if len(val_str) > 100:
                        val_str = val_str[:100] + "... [truncated]"
                    r_str.append(val_str)
                print("  ", r_str)
    conn.close()

def inspect_database_db():
    print("\n=== database.db ===")
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print("Tables:", tables)
    
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = [c[1] for c in cursor.fetchall()]
        print(f"\nTable: {table} (columns: {columns})")
        
        cursor.execute(f"SELECT * FROM {table};")
        rows = cursor.fetchall()
        print(f"Row count: {len(rows)}")
        for r in rows[:5]:
            r_str = []
            for val in r:
                val_str = str(val)
                if isinstance(val, bytes):
                    val_str = f"BLOB of length {len(val)}"
                elif len(val_str) > 100:
                    val_str = val_str[:100] + "... [truncated]"
                r_str.append(val_str)
            print("  ", r_str)
    conn.close()

if __name__ == "__main__":
    inspect_db_sqlite3()
    inspect_database_db()
