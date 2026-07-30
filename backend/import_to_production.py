"""Import local SQLite data to production Neon Postgres."""
import json
import psycopg2

NEON_URL = "postgresql://neondb_owner:npg_IvnyELN8D6ki@ep-proud-block-ag2yqppu.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

BOOL_COLS = {'is_active', 'is_produced'}

with open('data/export.json') as f:
    data = json.load(f)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

# Clear in reverse dependency order
clear_order = ['movement_lines', 'movements', 'cost_history', 'personnel_costs', 'items', 'categories', 'users', 'settings']
for table in clear_order:
    cur.execute(f'DELETE FROM {table}')
conn.commit()
print("Cleared all tables")

# Import in dependency order
import_order = ['categories', 'settings', 'users', 'items', 'movements', 'movement_lines', 'cost_history', 'personnel_costs']

for table in import_order:
    rows = data.get(table, [])
    if not rows:
        continue
    cols = list(rows[0].keys())
    col_names = ', '.join(cols)

    # Build placeholders with bool casting where needed
    placeholders = []
    for c in cols:
        if c in BOOL_COLS:
            placeholders.append('%s::boolean')
        else:
            placeholders.append('%s')
    ph_str = ', '.join(placeholders)

    insert_sql = f'INSERT INTO {table} ({col_names}) VALUES ({ph_str})'

    count = 0
    for row in rows:
        values = []
        for c in cols:
            v = row[c]
            if c in BOOL_COLS:
                v = bool(v) if v is not None else False
            values.append(v)
        try:
            cur.execute(insert_sql, values)
            count += 1
        except Exception as e:
            conn.rollback()
            cur = conn.cursor()
            # Re-clear and restart this table
            print(f"  Error in {table} row: {str(e)[:100]}")
            continue
    conn.commit()
    print(f"Imported {count}/{len(rows)} rows into {table}")

# Reset sequences
for table in ['categories', 'users', 'items', 'movements', 'movement_lines', 'cost_history', 'personnel_costs']:
    try:
        cur.execute(f"SELECT MAX(id) FROM {table}")
        max_id = cur.fetchone()[0]
        if max_id:
            cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), {max_id})")
            conn.commit()
    except Exception:
        conn.rollback()
        cur = conn.cursor()

# Verify
print("\n--- Verification ---")
for table in import_order:
    cur.execute(f'SELECT COUNT(*) FROM {table}')
    print(f"  {table}: {cur.fetchone()[0]} rows")

conn.close()
print("\nDone!")
