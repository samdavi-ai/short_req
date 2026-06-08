"""Add site, building, floor hierarchy

Revision ID: a7b3c9d1e2f4
Revises: d13eaa4d802b
Create Date: 2026-06-05 18:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic
revision = 'a7b3c9d1e2f4'
down_revision = 'd13eaa4d802b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create 'sites' table
    op.create_table(
        'sites',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('address', sa.Text()),
        sa.Column('latitude', sa.Float()),
        sa.Column('longitude', sa.Float()),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. Create 'buildings' table
    op.create_table(
        'buildings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('site_id', sa.Integer(), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('building_type', sa.String(20), server_default='INDOOR', nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_buildings_site_id', 'buildings', ['site_id'])

    # 3. Create 'floors' table
    op.create_table(
        'floors',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('building_id', sa.Integer(), sa.ForeignKey('buildings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_floors_building_id', 'floors', ['building_id'])

    # 4. Add building_id columns to existing tables (nullable initially)
    with op.batch_alter_table('cameras') as batch_op:
        batch_op.add_column(sa.Column('building_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_cameras_building_id', 'buildings', ['building_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_cameras_building_id', ['building_id'])

    with op.batch_alter_table('zones') as batch_op:
        batch_op.add_column(sa.Column('building_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_zones_building_id', 'buildings', ['building_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_zones_building_id', ['building_id'])

    with op.batch_alter_table('layouts') as batch_op:
        batch_op.add_column(sa.Column('building_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_layouts_building_id', 'buildings', ['building_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_layouts_building_id', ['building_id'])

    # 5. Seed default site and building, then backfill existing data
    conn = op.get_bind()

    # Insert default site
    conn.execute(text(
        "INSERT INTO sites (name, address) VALUES ('Default Site', 'Main Location')"
    ))
    site_row = conn.execute(text("SELECT id FROM sites WHERE name = 'Default Site'")).fetchone()
    site_id = site_row[0]

    # Insert default building
    conn.execute(text(
        f"INSERT INTO buildings (site_id, name, building_type) VALUES ({site_id}, 'Main Building', 'INDOOR')"
    ))
    bldg_row = conn.execute(text(f"SELECT id FROM buildings WHERE site_id = {site_id} AND name = 'Main Building'")).fetchone()
    bldg_id = bldg_row[0]

    # Insert default floors based on distinct floor numbers in cameras table
    existing_floors = conn.execute(text("SELECT DISTINCT floor FROM cameras ORDER BY floor")).fetchall()
    default_floor_labels = {-1: 'Basement', 0: 'Ground', 1: 'Floor 1', 2: 'Floor 2', 3: 'Floor 3', 4: 'Floor 4', 5: 'Roof'}
    seen_levels = set()
    for row in existing_floors:
        level = row[0]
        if level not in seen_levels:
            label = default_floor_labels.get(level, f'Floor {level}')
            conn.execute(text(
                f"INSERT INTO floors (building_id, level, label, sort_order) VALUES ({bldg_id}, {level}, '{label}', {level + 100})"
            ))
            seen_levels.add(level)

    # If no cameras exist yet, create at least a ground floor
    if not seen_levels:
        conn.execute(text(
            f"INSERT INTO floors (building_id, level, label, sort_order) VALUES ({bldg_id}, 0, 'Ground', 100)"
        ))

    # 6. Backfill building_id on existing records
    conn.execute(text(f"UPDATE cameras SET building_id = {bldg_id} WHERE building_id IS NULL"))
    conn.execute(text(f"UPDATE zones SET building_id = {bldg_id} WHERE building_id IS NULL"))
    conn.execute(text(f"UPDATE layouts SET building_id = {bldg_id} WHERE building_id IS NULL"))


def downgrade() -> None:
    # Remove building_id from existing tables
    with op.batch_alter_table('layouts') as batch_op:
        batch_op.drop_index('ix_layouts_building_id')
        batch_op.drop_constraint('fk_layouts_building_id', type_='foreignkey')
        batch_op.drop_column('building_id')

    with op.batch_alter_table('zones') as batch_op:
        batch_op.drop_index('ix_zones_building_id')
        batch_op.drop_constraint('fk_zones_building_id', type_='foreignkey')
        batch_op.drop_column('building_id')

    with op.batch_alter_table('cameras') as batch_op:
        batch_op.drop_index('ix_cameras_building_id')
        batch_op.drop_constraint('fk_cameras_building_id', type_='foreignkey')
        batch_op.drop_column('building_id')

    op.drop_table('floors')
    op.drop_table('buildings')
    op.drop_table('sites')
